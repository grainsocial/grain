FROM denoland/deno:2.3.3

WORKDIR /app

COPY . .

RUN deno cache main.ts

EXPOSE 8080

CMD ["run", "-A", "main.ts"]
