ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo "$TZ" > /etc/timezone

apt update
apt install -y \
    wget \
    curl \
    git \
    dnsutils \
    unzip \
    openssh-client \
    rsync

mkdir /var/php
chmod 777 /var/php
