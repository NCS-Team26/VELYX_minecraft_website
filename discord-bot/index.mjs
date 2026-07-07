import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { ApiError, broadcastToMinecraft, checkVerification, getInventory, getMarket, getPortfolio, getServerOverview, playerAction, startVerification, tradeStock } from "./api.mjs";
import { createStockChart } from "./chart.mjs";
import { config, requireDiscordConfig } from "./config.mjs";
import { STOCK_SYMBOL_HINTS } from "./commands.mjs";
import {
  asList,
  findStock,
  formatBytes,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedMoney,
  stockDisplayName,
} from "./format.mjs";
import { LinkStore } from "./store.mjs";

class UserFacingError extends Error {}

requireDiscordConfig();

const store = new LinkStore(config.dataDir);
await store.load();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function linkButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("웹 주식장")
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.siteUrl}/plugins.html#stock-marketplace`),
      new ButtonBuilder()
        .setLabel("로그인/인증")
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.siteUrl}/login.html`),
      new ButtonBuilder()
        .setLabel("서버 접속")
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.siteUrl}/join.html`),
    ),
  ];
}

function stockColor(change) {
  const number = Number(change);
  if (number > 0) return 0xff5a66;
  if (number < 0) return 0x5b9cff;
  return 0x56d364;
}

function buildStockEmbed(stock) {
  const price = Number(stock.price);
  const open = Number(stock.open24h);
  const diff = Number.isFinite(price) && Number.isFinite(open) ? price - open : 0;
  return new EmbedBuilder()
    .setColor(stockColor(stock.change24h))
    .setTitle(stockDisplayName(stock))
    .setURL(`${config.siteUrl}/plugins.html#stock-marketplace`)
    .setDescription("서버 주식장 실시간 시세")
    .addFields(
      { name: "현재가", value: formatMoney(stock.price), inline: true },
      { name: "전일비", value: formatSignedMoney(diff), inline: true },
      { name: "등락률", value: formatPercent(stock.change24h), inline: true },
      { name: "시가총액", value: formatMoney(stock.marketCap), inline: true },
      { name: "고가", value: formatMoney(stock.high24h), inline: true },
      { name: "저가", value: formatMoney(stock.low24h), inline: true },
      { name: "거래량", value: formatNumber(stock.volume24h), inline: true },
      { name: "웹 거래", value: `[포트폴리오 열기](${config.siteUrl}/login.html)`, inline: true },
      { name: "서버", value: config.minecraftAddress, inline: true },
    )
    .setImage(`attachment://${stock.symbol || stock.code}-chart.png`)
    .setTimestamp(new Date());
}

function buildMarketEmbed(payload) {
  const stocks = [...(payload.stocks || [])].sort((left, right) => Math.abs(Number(right.change24h) || 0) - Math.abs(Number(left.change24h) || 0));
  const movers = stocks
    .slice(0, 4)
    .map((stock) => `${stock.symbol}: ${formatMoney(stock.price)} (${formatPercent(stock.change24h)})`);
  const recentTrades = (payload.recentTrades || [])
    .slice(0, 4)
    .map((trade) => `${trade.playerName} ${trade.side === "buy" ? "매수" : "매도"} ${trade.symbol} ${formatNumber(trade.quantity)}주`);

  return new EmbedBuilder()
    .setColor(0x56d364)
    .setTitle("NFOIFSB 24H 주식장")
    .setURL(`${config.siteUrl}/plugins.html#stock-marketplace`)
    .addFields(
      { name: "시장지수", value: formatMoney(payload.market?.index), inline: true },
      { name: "24H 변동", value: formatPercent(payload.market?.indexChange24h), inline: true },
      { name: "거래량", value: formatNumber(payload.market?.volume24h), inline: true },
      { name: "시가총액", value: formatMoney(payload.market?.marketCap), inline: true },
      { name: "주요 변동", value: asList(movers), inline: false },
      { name: "최근 체결", value: asList(recentTrades), inline: false },
    )
    .setFooter({ text: payload.market?.session || "24H LIVE" })
    .setTimestamp(payload.market?.updatedAt ? new Date(payload.market.updatedAt) : new Date());
}

function buildPortfolioEmbed(payload) {
  const positions = (payload.positions || [])
    .filter((position) => Number(position.shares) > 0)
    .map((position) =>
      `${position.symbol} ${formatNumber(position.shares)}주 · 평가 ${formatMoney(position.value)} · ${formatPercent(position.change24h)}`,
    );
  return new EmbedBuilder()
    .setColor(0x56d364)
    .setTitle(`${payload.nickname} 포트폴리오`)
    .addFields(
      { name: "서버 머니", value: formatMoney(payload.balance), inline: true },
      { name: "주식 평가액", value: formatMoney(payload.portfolioValue), inline: true },
      { name: "보유 종목", value: asList(positions, "보유 주식 없음"), inline: false },
    )
    .setTimestamp(payload.updatedAt ? new Date(payload.updatedAt) : new Date());
}

function buildServerEmbed(payload) {
  const memory = payload.memory || {};
  const cpu = payload.system?.cpu || {};
  const temp = payload.system?.temperature || {};
  const tps = Array.isArray(payload.tps) ? payload.tps.map((value) => formatNumber(value, 2)).join(" / ") : "--";
  return new EmbedBuilder()
    .setColor(0x56d364)
    .setTitle("마인크래프트 서버 상태")
    .setURL(`${config.siteUrl}/status.html`)
    .addFields(
      { name: "접속자", value: `${formatNumber(payload.players?.online)} / ${formatNumber(payload.players?.max)}`, inline: true },
      { name: "TPS", value: tps, inline: true },
      { name: "버전", value: payload.minecraftVersion || "--", inline: true },
      { name: "메모리", value: `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.maxBytes)} (${formatPercent(memory.usedPercent)})`, inline: true },
      { name: "CPU", value: cpu.systemLoadPercent === undefined ? "--" : formatPercent(cpu.systemLoadPercent), inline: true },
      { name: "온도", value: temp.available ? `${formatNumber(temp.celsius, 1)}°C` : "--", inline: true },
      { name: "연동 계정", value: formatNumber(payload.linkedPlayers), inline: true },
      { name: "경제", value: payload.economyProvider || "--", inline: true },
      { name: "주소", value: config.minecraftAddress, inline: true },
    )
    .setTimestamp(payload.updatedAt ? new Date(payload.updatedAt) : new Date());
}

function buildOnlineEmbed(payload) {
  const players = payload.players?.list || [];
  return new EmbedBuilder()
    .setColor(players.length ? 0x56d364 : 0x9098a3)
    .setTitle("현재 온라인 플레이어")
    .setDescription(
      players.length
        ? players.map((player) => `${player.name} · ${formatNumber(player.ping)}ms`).join("\n")
        : "현재 접속 중인 플레이어가 없습니다.",
    )
    .setFooter({ text: `${formatNumber(payload.players?.online)} / ${formatNumber(payload.players?.max)}` })
    .setTimestamp(payload.updatedAt ? new Date(payload.updatedAt) : new Date());
}

function buildInventoryEmbed(payload) {
  const equipment = payload.equipment || {};
  const equipmentLines = [
    ["주 손", equipment.mainHand],
    ["보조 손", equipment.offHand],
    ["투구", equipment.helmet],
    ["갑옷", equipment.chestplate],
    ["바지", equipment.leggings],
    ["신발", equipment.boots],
  ].map(([label, item]) => `${label}: ${item ? `${item.name} x${item.count}` : "비어 있음"}`);
  const items = (payload.items || [])
    .slice(0, 16)
    .map((item) => `${String(item.slot + 1).padStart(2, "0")} · ${item.name} x${item.count}`);
  return new EmbedBuilder()
    .setColor(0x56d364)
    .setTitle(`${payload.nickname} 인벤토리`)
    .addFields(
      { name: "상태", value: `레벨 ${payload.level ?? "--"} · HP ${payload.health ?? "--"}`, inline: true },
      { name: "위치", value: `${payload.world || "--"} · ${payload.location || "--"}`, inline: true },
      { name: "장비", value: equipmentLines.join("\n"), inline: false },
      { name: "아이템", value: asList(items, "비어 있음"), inline: false },
    )
    .setTimestamp(payload.updatedAt ? new Date(payload.updatedAt) : new Date());
}

function buildTradeEmbed(payload, side) {
  const sideLabel = side === "buy" ? "매수" : "매도";
  return new EmbedBuilder()
    .setColor(side === "buy" ? 0xff5a66 : 0x5b9cff)
    .setTitle(`주식 ${sideLabel} 체결`)
    .addFields(
      { name: "종목", value: `${payload.name || payload.symbol} (${payload.symbol})`, inline: true },
      { name: "수량", value: `${formatNumber(payload.quantity)}주`, inline: true },
      { name: "체결가", value: formatMoney(payload.price), inline: true },
      { name: "총액", value: formatMoney(payload.total), inline: true },
      { name: "수수료", value: formatMoney(payload.fee), inline: true },
    )
    .setTimestamp(payload.at ? new Date(payload.at) : new Date());
}

function accountLinkMessage() {
  return "먼저 `/마크 인증 닉네임:<마크닉>`으로 Discord 계정과 마크 캐릭터를 연결해 주세요.";
}

function getRequiredLink(interaction) {
  const link = store.getLink(interaction.user.id);
  if (!link?.webToken) throw new UserFacingError(accountLinkMessage());
  return link;
}

async function defer(interaction, ephemeral = false) {
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
}

async function handleStock(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const publicAction = subcommand === "지원금" && config.publicActionReplies;
  await defer(interaction, ["내계좌", "매수", "매도"].includes(subcommand) || !publicAction);

  if (subcommand === "시장") {
    const market = await getMarket();
    await interaction.editReply({ embeds: [buildMarketEmbed(market)], components: linkButtons() });
    return;
  }

  if (subcommand === "종목") {
    const market = await getMarket();
    const stock = findStock(market, interaction.options.getString("종목", true));
    if (!stock) throw new UserFacingError(`없는 종목입니다. 사용 가능: ${(market.stocks || []).map((item) => item.symbol).join(", ")}`);
    const chart = new AttachmentBuilder(createStockChart(stock), { name: `${stock.symbol || stock.code}-chart.png` });
    await interaction.editReply({
      embeds: [buildStockEmbed(stock)],
      files: [chart],
      components: linkButtons(),
    });
    return;
  }

  if (subcommand === "내계좌") {
    const payload = await getPortfolio(getRequiredLink(interaction));
    await interaction.editReply({ embeds: [buildPortfolioEmbed(payload)], components: linkButtons() });
    return;
  }

  if (subcommand === "매수" || subcommand === "매도") {
    const link = getRequiredLink(interaction);
    const symbol = interaction.options.getString("종목", true).toUpperCase();
    const quantity = interaction.options.getInteger("수량", true);
    const payload = await tradeStock(link, symbol, subcommand === "매수" ? "buy" : "sell", quantity);
    await interaction.editReply({ embeds: [buildTradeEmbed(payload, subcommand === "매수" ? "buy" : "sell")], components: linkButtons() });
    return;
  }

  if (subcommand === "지원금") {
    const link = getRequiredLink(interaction);
    try {
      const payload = await playerAction(link, "daily-reward");
      const embed = new EmbedBuilder()
        .setColor(0x56d364)
        .setTitle("주식 지원금")
        .setDescription(`${link.nickname}님 지원금 수령 완료.`)
        .addFields({ name: "지급액", value: formatMoney(payload.money), inline: true })
        .setTimestamp(new Date());
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const remaining = error.payload?.remainingSeconds;
        await interaction.editReply(`지원금 수령 한도를 초과하였습니다.${remaining ? ` 남은 시간: ${formatDuration(remaining)}` : ""}`);
        return;
      }
      throw error;
    }
  }
}

async function handleMinecraft(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const ephemeral = ["인증", "확인", "인벤토리", "공지"].includes(subcommand);
  await defer(interaction, ephemeral);

  if (subcommand === "상태") {
    const overview = await getServerOverview();
    await interaction.editReply({ embeds: [buildServerEmbed(overview)], components: linkButtons() });
    return;
  }

  if (subcommand === "온라인") {
    const overview = await getServerOverview();
    await interaction.editReply({ embeds: [buildOnlineEmbed(overview)] });
    return;
  }

  if (subcommand === "웹") {
    const embed = new EmbedBuilder()
      .setColor(0x56d364)
      .setTitle("NFOIFSB 웹 연동")
      .setDescription("웹사이트, Discord 봇, 마인크래프트 서버가 같은 AuroraLink API를 사용합니다.")
      .addFields(
        { name: "서버 주소", value: config.minecraftAddress, inline: true },
        { name: "인증", value: `[로그인 페이지](${config.siteUrl}/login.html)`, inline: true },
        { name: "경제장", value: `[웹 Economy](${config.siteUrl}/plugins.html#stock-marketplace)`, inline: true },
      );
    await interaction.editReply({ embeds: [embed], components: linkButtons() });
    return;
  }

  if (subcommand === "인증") {
    const nickname = interaction.options.getString("닉네임", true).trim();
    const payload = await startVerification(nickname, interaction.user);
    if (payload.verified && payload.webToken) {
      await store.setLink(interaction.user.id, payload);
      await interaction.editReply(`${payload.nickname} 캐릭터가 이미 인증되어 있어 Discord 계정에 연결했습니다.`);
      return;
    }
    await store.setPending(interaction.user.id, payload);
    await interaction.editReply(
      [
        `${nickname} 인증 코드를 발급했습니다.`,
        `마인크래프트 서버에서 \`/webauth ${payload.code}\` 입력 후 Discord에서 \`/마크 확인\`을 실행하세요.`,
        payload.expiresAt ? `만료: ${payload.expiresAt}` : "",
      ].filter(Boolean).join("\n"),
    );
    return;
  }

  if (subcommand === "확인") {
    const pending = store.getPending(interaction.user.id);
    const nickname = interaction.options.getString("닉네임")?.trim() || pending?.nickname;
    const code = interaction.options.getString("코드")?.trim() || pending?.code;
    if (!nickname || !code) throw new UserFacingError("먼저 `/마크 인증 닉네임:<마크닉>`으로 인증 코드를 발급해 주세요.");
    const payload = await checkVerification(nickname, code, interaction.user);
    if (!payload.verified || !payload.webToken) {
      await interaction.editReply("아직 인게임 인증이 확인되지 않았습니다. 서버에서 `/webauth 코드`를 입력했는지 확인해 주세요.");
      return;
    }
    await store.setLink(interaction.user.id, payload);
    await interaction.editReply(
      `${payload.nickname} 캐릭터 인증 완료. 이제 \`/주식 내계좌\`, \`/주식 매수\`, \`/마크 인벤토리\`를 사용할 수 있습니다.`,
    );
    return;
  }

  if (subcommand === "인벤토리") {
    const payload = await getInventory(getRequiredLink(interaction));
    await interaction.editReply({ embeds: [buildInventoryEmbed(payload)], components: linkButtons() });
    return;
  }

  if (subcommand === "공지") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new UserFacingError("서버 관리 권한이 있는 사람만 공지를 보낼 수 있습니다.");
    }
    if (!config.adminToken) {
      throw new UserFacingError("DISCORD_MINECRAFT_ADMIN_TOKEN 환경변수가 아직 설정되지 않았습니다.");
    }
    const message = interaction.options.getString("내용", true).trim();
    await broadcastToMinecraft(message);
    await interaction.editReply("마크 서버에 공지를 보냈습니다.");
  }
}

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  try {
    const market = await getMarket();
    const choices = (market.stocks || [])
      .filter((stock) => {
        const haystack = `${stock.symbol || ""} ${stock.name || ""}`.toLowerCase();
        return !focused || haystack.includes(focused);
      })
      .slice(0, 25)
      .map((stock) => ({ name: `${stock.symbol} · ${stock.name}`, value: stock.symbol }));
    await interaction.respond(choices.length ? choices : STOCK_SYMBOL_HINTS.map((symbol) => ({ name: symbol, value: symbol })));
  } catch {
    await interaction.respond(STOCK_SYMBOL_HINTS.map((symbol) => ({ name: symbol, value: symbol })));
  }
}

async function handleCommand(interaction) {
  if (interaction.commandName === "주식") {
    await handleStock(interaction);
    return;
  }
  if (interaction.commandName === "마크") {
    await handleMinecraft(interaction);
  }
}

client.once("ready", () => {
  console.log(`Discord bridge bot logged in as ${client.user.tag}`);
  console.log(`AuroraLink API: ${config.playerApiBase}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    await handleCommand(interaction);
  } catch (error) {
    const message = error instanceof UserFacingError || error instanceof ApiError
      ? error.message
      : "봇 명령 처리 중 오류가 발생했습니다.";
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message, embeds: [], components: [], files: [] }).catch(() => {});
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

await client.login(config.token);
