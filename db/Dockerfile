FROM mysql:8.0

# Install Python for seed script
RUN microdnf install -y python3 python3-pip && \
    pip3 install mysql-connector-python==8.2.0 && \
    microdnf clean all

# Copy schema SQL (runs first alphabetically)
COPY 01-schema.sql /docker-entrypoint-initdb.d/01-schema.sql

# Copy seed script and CSV
RUN mkdir -p /seed
COPY seed/seed_loader.py /seed/seed_loader.py
COPY 02-seed.sh /docker-entrypoint-initdb.d/02-seed.sh

# Copy CSV data file
COPY product_datasets.csv /docker-entrypoint-initdb.d/product_datasets.csv

# Make shell script executable
RUN chmod +x /docker-entrypoint-initdb.d/02-seed.sh

# Set environment for seed script
ENV CSV_FILE=/docker-entrypoint-initdb.d/product_datasets.csv
ENV SEED_MYSQL_HOST=localhost
ENV SEED_MYSQL_PORT=3306
ENV SEED_MYSQL_USER=root
