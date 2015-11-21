# Gartner IT Xpo 2015

Spin plugin for Gartner IT Xpo 2015 in Barcelona

##How to Use

- Contact Atomize Software at contact@atomizesoftware.com to get a valid Spin license.
- Download the Spin SDK from [here](https://s3.amazonaws.com/downloads.atomizesoftware.com/spin-sdk-Hydrogen-2015.11.03.0.zip)
- Download the Spin APK from [here](https://s3.amazonaws.com/downloads.atomizesoftware.com/spin-Hydrogen-gartneritxpo2015.apk)
- Import the project in IntelliJ and add a run configuration to it [more info here](http://docs.atomizesoftware.com/spin/98-developers-guide/01-getting-started.html)
- Rename the application.conf.example file to application.conf.
- Do the same to the build.sbt.example file.
- Put the credentials you received from the Spin license into the build.sbt line 110.
    - Replace example@email.com with your email
    - Replace examplePassword with your password.
- You will need PostgreSQL 9.4 with PostGIS 2.1 ([Linux install instructions](https://trac.osgeo.org/postgis/wiki/UsersWikiPostGIS21UbuntuPGSQL93Apt))([OSX install instructions](http://postgresapp.com/))
- Create a new database for Spin: 
    - Open psql by running: psql -U postgres -h localhost
    - Create the database by running: CREATE DATABASE gartnerbarcelona2015;
- Create the database schema using the SDK with the following command:
    
    `java -jar spin-sdk.jar setup-db --dbHost=localhost --dbPort="5432" --dbUser="postgres" --dbPassword=123456 --dbName=gartnerbarcelona2015 --createSchema=y --fillDemoData=n`
- Fill the database with the Demo data by running fill_database.sh:
    
    `./fill_database.sh localhost gartnerbarcelona2015 123456`
- Update the application.conf by replacing:
    
    c3p0.jdbcUrl = "jdbc:postgresql://localhost/gartnerbarcelona2015" with host and database name that you created.
    
    c3p0.user = "postgres" with your PostgreSQL user
    
    c3p0.password = "123456" with the password you gave your PostgreSQL user

*This assumes you installed PostgreSQL in localhost, if not just replace localhost with the IP Address of where you have it.*
