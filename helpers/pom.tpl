<?xml version="1.0" encoding="UTF-8"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd" xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <modelVersion>4.0.0</modelVersion>

    <name>Player UI Devtools - {artifactId}</name>
    <description>Developer tooling for the Player UI platform</description>
    <url>https://player-ui.github.io</url>
    <licenses>
        <license>
            <name>Apache License, Version 2.0</name>
            <url>https://www.apache.org/licenses/LICENSE-2.0.txt</url>
        </license>
    </licenses>
    <developers>
        <developer>
            <id>sugarmanz</id>
            <name>Jeremiah Zucker</name>
            <email>zucker.jeremiah@gmail.com</email>
        </developer>
    </developers>
    <scm>
        <connection>https://github.com/player-ui/devtools.git</connection>
        <developerConnection>https://github.com/player-ui/devtools.git</developerConnection>
        <tag>v{version}</tag>
        <url>https://github.com/player-ui/devtools.git</url>
    </scm>

    <groupId>{groupId}</groupId>
    <artifactId>{artifactId}</artifactId>
    <version>{version}</version>
    <packaging>{type}</packaging>

    <dependencies>
{dependencies}
    </dependencies>
</project>
