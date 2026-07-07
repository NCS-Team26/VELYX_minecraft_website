import { SlashCommandBuilder } from "discord.js";

export const STOCK_SYMBOL_HINTS = ["DMD", "FARM", "LOG", "RED"];

function stockSymbolOption(option) {
  return option
    .setName("종목")
    .setDescription("종목 코드 또는 이름")
    .setRequired(true)
    .setAutocomplete(true);
}

function quantityOption(option) {
  return option
    .setName("수량")
    .setDescription("거래 수량")
    .setMinValue(1)
    .setMaxValue(500)
    .setRequired(true);
}

export function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName("주식")
      .setDescription("VELYX 서버 Economy")
      .addSubcommand((subcommand) =>
        subcommand.setName("시장").setDescription("전체 주식장 요약을 봅니다."),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("종목")
          .setDescription("종목 시세와 차트를 봅니다.")
          .addStringOption(stockSymbolOption),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("내계좌").setDescription("연동된 마크 계정의 포트폴리오를 봅니다."),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("매수")
          .setDescription("마크 서버 머니로 주식을 매수합니다.")
          .addStringOption(stockSymbolOption)
          .addIntegerOption(quantityOption),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("매도")
          .setDescription("보유 주식을 매도합니다.")
          .addStringOption(stockSymbolOption)
          .addIntegerOption(quantityOption),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("지원금").setDescription("연동된 마크 캐릭터로 지원금을 수령합니다."),
      ),
    new SlashCommandBuilder()
      .setName("마크")
      .setDescription("웹사이트, Discord, 마인크래프트 연동")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("인증")
          .setDescription("Discord 계정과 마크 캐릭터를 연결합니다.")
          .addStringOption((option) =>
            option.setName("닉네임").setDescription("마인크래프트 닉네임").setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("확인")
          .setDescription("인게임 /webauth 인증 완료 여부를 확인합니다.")
          .addStringOption((option) =>
            option.setName("닉네임").setDescription("마인크래프트 닉네임").setRequired(false),
          )
          .addStringOption((option) =>
            option.setName("코드").setDescription("봇이 발급한 인증 코드").setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("상태").setDescription("마인크래프트 서버 상태를 봅니다."),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("온라인").setDescription("현재 접속 중인 플레이어를 봅니다."),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("인벤토리").setDescription("연동된 캐릭터의 인벤토리 요약을 봅니다."),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("공지")
          .setDescription("Discord에서 마크 서버로 공지를 보냅니다.")
          .addStringOption((option) =>
            option.setName("내용").setDescription("서버에 브로드캐스트할 내용").setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("웹").setDescription("웹사이트와 인증 페이지 링크를 봅니다."),
      ),
  ];
}

export const commandPayloads = buildCommands().map((command) => command.toJSON());
