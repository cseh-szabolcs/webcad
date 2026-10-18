#!/bin/bash
ENV TZ=Europe/Zurich
 ln -snf /usr/share/zoneinfo/"$TZ" /etc/localtime && echo "$TZ" > /etc/timezone

curl -sSLf \
  -o /usr/local/bin/install-php-extensions \
  https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions

chmod +x /usr/local/bin/install-php-extensions

install-php-extensions pdo pdo_mysql opcache apcu intl zip bcmath gd imagick xdebug mcrypt

for var in "$@"
do
    install-php-extensions "$var"
done

rm -R /usr/local/bin/install-php-extensions
