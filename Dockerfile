FROM php:7.1-cli

# Set correct environment variables.
ENV DEBIAN_FRONTEND=noninteractive
ENV HOME /root
ENV PATH=$PATH:/opt/go/bin

# Ubuntu mirrors
RUN apt-get update

# Repo for Node
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install requirements for standard builds.
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
    wget \
    git \
    python3-pip \
    python3-dev \
    python3-venv \
    build-essential \
    nodejs \
    wget \
    tar \


    # instal modules
    && npm install -g npm@11.2.0 \
    && npm install -g ts-node --save-dev \
    && pip3 install typing-extensions \
    && pip3 install --upgrade build \
    && wget https://go.dev/dl/go1.23.7.linux-amd64.tar.gz \
    && tar -C /opt -xzf go1.23.7.linux-amd64.tar.gz \


    # Standard cleanup
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \

    # Composer installation.
    && curl -sS https://getcomposer.org/installer | php \
    && mv composer.phar /usr/bin/composer \
    && composer selfupdate



ENTRYPOINT ["tail", "-f", "/dev/null"]
