
# API pour Capteur solaire à air

Cette API permet à l'application associée au projet de recevoir les données transmises en temps réel par le capteur solaire à air. L'API permet également de pouvoir contrôler à distance le capteur solaire à air.

*Fait partie de mon projet de Terminale STI2D de 2026.*

![GitHub Repo stars](https://img.shields.io/github/stars/climoux/capteur-solaire-api)

## Références API

#### Get all items

```http
  GET /api/items
```

| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `api_key` | `string` | **Required**. Your API key |

#### Get item

```http
  GET /api/items/${id}
```

| Parameter | Type     | Description                       |
| :-------- | :------- | :-------------------------------- |
| `id`      | `string` | **Required**. Id of item to fetch |

#### add(num1, num2)

Takes two numbers and returns the sum.

