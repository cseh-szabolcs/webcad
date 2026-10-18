FROM php:8.5-fpm

ENV TZ=Europe/Zurich
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY ./scripts/php.packages.sh /tmp/scripts/packages.sh
RUN chmod +x /tmp/scripts/packages.sh && /tmp/scripts/packages.sh

COPY ./scripts/php.extensions.sh /tmp/scripts/extensions.sh
RUN chmod +x /tmp/scripts/extensions.sh && /tmp/scripts/extensions.sh

# Symfony cli
RUN curl -1sLf 'https://dl.cloudsmith.io/public/symfony/stable/setup.deb.sh' | bash
RUN apt install symfony-cli
RUN symfony server:ca:install

WORKDIR /app

# Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
