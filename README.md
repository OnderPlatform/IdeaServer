# IdeaServer
Idea server implementation

Для запуска сервера необходимо:

* Поставить postgres и запустить его
* Создать в ней новую пустую базу данных `ideaserver`
* Перейти в директорию этого сервера
* Выполнить команды:
```
yarn install
yarn build
yarn start
```

Если все выполнилось успешно, сервер создаст в БД `ideaserver` новые таблицы.
В текущей реализации сервер сам генерирует случайные данные для 3 producer, 4 consumer, 2 prosumer и 1 operator.
