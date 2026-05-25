
# API pour Capteur solaire à air

Cette API permet à l'application associée au projet de recevoir les données transmises en temps réel par le capteur solaire à air. L'API permet également de pouvoir contrôler à distance le capteur solaire à air.

*Fait partie de mon projet de Terminale STI2D de 2026.*

**Attention : cette API n'est pas encore terminée et ne sera plus mise à jour.**
## Variables d'environnement

Pour lancer l'API, vous devrez ajouter les variables d'environnement suivantes à votre fichier .env

`PORT` (optionnel : le port par défaut est **5008**)

`DATABASE_URL` (URL PostgreSQL : **postgresql://postgres:password@localhost:5432/database**)


## Exécuter localement

Clone le projet

```bash
  git clone https://github.com/climoux/capteur-solaire-api.git
```

Accéder au dossier du projet

```bash
  cd capteur-solaire-api
```

Installer les dépendances

```bash
  npm install
```

Lancer le serveur

```bash
  npm run start
```


## Déploiement

Pour déployer ce projet, exécutez

```bash
  npm run build
```


## Références API

#### Enregistrer un nouveau appareil

```http
  POST /devices/register
```

#### Se connecter à un appareil

```http
  POST /devices/pair
```

| Data          | Type     | Description                                     |
| :------------ | :------- | :---------------------------------------------- |
| `pairingCode` | `string` | **Requis**. Code pour se connecter à l'appareil |

#### Avoir les données d'un appareil

```http
  GET /devices/:id
```

| Parameters | Type     | Description                  |
| :--------- | :------- | :--------------------------- |
| `id`       | `string` | **Requis**. ID de l'appareil |

#### Supprimer un appareil

```http
  DELETE /devices/:id
```

| Parameters | Type     | Description                  |
| :--------- | :------- | :--------------------------- |
| `id`       | `string` | **Requis**. ID de l'appareil |
## Licence

Ce projet est protégé par la licence [MIT](https://choosealicense.com/licenses/mit/)
