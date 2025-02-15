#### Важное замечание: под паролем ВСЕГДА подразумевается его хэш. Сам же пароль мы НИКОГДА не передаем по сети.
| Request | Accept | Action | Return |
|:-|:-|:-|:-|
| GetStickers | __event__: "GetStickers" | Передаёт стикеры и подсказки к ним | __stickers__: список ссылок на эти картинки, относительно домена bomes.ru<br/> __hints__: массив массивов строк подсказок<br/> __event__: "ReturnStickers" |
| GetReactions | __event__: "GetReactions" | Передаёт реакции | __reactionsURLs__: список строк путей реакций<br/>__event__: "ReturnReactions" |
| GetCurrentAndroidVersion | __event__: "GetCurrentAndroidVersion" | Передаёт текущую андроид версию | __version__: число<br/> текущая андроид версия<br>__event__: "ReturnCurrentAndroidVersion" |