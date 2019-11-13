FROM ubuntu:18.04
RUN apt-get update && apt-get install -y software-properties-common postgresql postgresql-client postgresql-contrib
USER postgres
RUN    /etc/init.d/postgresql start &&\
    psql --command "CREATE USER server WITH SUPERUSER PASSWORD 'server123';" &&\
    createdb -O server idea-server
RUN echo "host all  all    0.0.0.0/0  md5" >> /etc/postgresql/10/main/pg_hba.conf
RUN echo "listen_addresses='*'" >> /etc/postgresql/10/main/postgresql.conf
EXPOSE 5432
VOLUME  ["/etc/postgresql", "/var/log/postgresql", "/var/lib/postgresql"]
CMD ["/usr/lib/postgresql/10/bin/postgres", "-D", "/var/lib/postgresql/10/main", "-c", "config_file=/etc/postgresql/10/main/postgresql.conf"]