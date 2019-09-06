# IdeaServer
Idea server implementation

Для запуска сервера, необходимо запустить

1. yarn install
2. yarn build
3. yarn start

При повторном запуске выполнять первую команду необязательно

# Contracts service
Для запуска сервиса нотаризации необходимо

1. cd contracts
2. yarn install
3. yarn build
4. yarn start

Сервсис развернет RestApi сервер с методами

POST /timestamp/add - создать слепок
пример запроса 
```
{
	"date": "1567797555",
	"entries": [
		{
			"field1": "1",
			"field2": "2"
		},
		{
			"field1": "3",
			"field2": "4"
		}
	]
}
```
где `date` - текущая метка времени
`entries` - массив данных для слепка. В свободном формате.

пример ответа 
```
{
    "txHash": "0x3aecabbb379fdb92695c2f456f8e9d373d0a65676b28ce4cc11bd3d19ad187d7",
    "blockNumber": 5044127,
    "dataHash": "0x1a3a12f5e77454d285d5665cdfc2d382caacce81a87023d998bf439506e5a463"
}
```
где `txHash` - хэш транзации в блокчейне.
`dataHash` - хэш данных, который пишется в транзакцию

POST /timestamp/check - проверить слепок
в запрос передаем то же самое, что и передали в создание слепка.
Если слепок не найден, сервер отдаст ошибку 404.
Если данные есть, вернется такой результат
```
{
    "timestampOfNotary": 1567800613,
    "timestampOfMetering": "1567717200",
    "dataHash": "0x1a3a12f5e77454d285d5665cdfc2d382caacce81a87023d998bf439506e5a463"
}
```
значит данные корректны, проверка нотаризации успешна.
