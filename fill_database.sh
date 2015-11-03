#!/bin/bash
baseDir=${PWD}

cd ${baseDir}/migrations

java -jar liquibase.jar --logLevel=info --classpath="postgresql_jdbc4.jar" --driver=org.postgresql.Driver --url=jdbc:postgresql://$1/$2 --username=postgres --password=$3 --changeLogFile="production_changelog.xml" update