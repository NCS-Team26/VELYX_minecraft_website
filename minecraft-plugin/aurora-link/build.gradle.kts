plugins {
  java
}

group = "kr.nfoifsb"
version = "0.1.0"

java {
  toolchain.languageVersion.set(JavaLanguageVersion.of(21))
}

dependencies {
  compileOnly("io.papermc.paper:paper-api:1.21.8-R0.1-SNAPSHOT")
  compileOnly("com.github.MilkBowl:VaultAPI:1.7.1")
  implementation("com.google.code.gson:gson:2.11.0")
}

tasks.processResources {
  filesMatching("plugin.yml") {
    expand("version" to project.version)
  }
}

tasks.withType<JavaCompile> {
  options.encoding = "UTF-8"
}

tasks.jar {
  archiveBaseName.set("AuroraLink")
  archiveClassifier.set("")
  duplicatesStrategy = DuplicatesStrategy.EXCLUDE
  from(configurations.runtimeClasspath.get().map { if (it.isDirectory) it else zipTree(it) })
}
