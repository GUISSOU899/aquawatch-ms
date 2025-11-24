# 🌊 AquaWatch-MS - Plateforme de Surveillance de la Qualité de l'Eau

Prototype complet de plateforme de surveillance en temps réel de la qualité de l'eau avec architecture microservices Node.js.

## 📋 Vue d'ensemble

AquaWatch-MS est une plateforme modulaire qui collecte, analyse et alerte sur la qualité de l'eau en temps réel via des capteurs IoT simulés. Le système comprend :

- **Microservice Ingestion** : Réception des données capteurs via MQTT et stockage dans TimescaleDB
- **Microservice Alertes** : Vérification périodique des seuils OMS et génération d'alertes
- **Microservice API REST** : Endpoints pour consulter les mesures et alertes
- **Simulateur de Capteurs** : Script pour générer des données de test

## 🏗️ Architecture

```
┌─────────────┐
│  Capteurs   │──MQTT──>┌──────────────┐
│   IoT (3)   │         │  Ingestion   │──> TimescaleDB
└─────────────┘         │   (MQTT)     │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Alertes    │──> TimescaleDB (alerts)
                        │  (Vérif. 1min)│
                        └──────────────┘
                               │
                        ┌──────────────┐
                        │   API REST   │<─── Consommateurs
                        │   (Express)  │
                        └──────────────┘
```

## 📦 Prérequis

- **Node.js** (version 16 ou supérieure)
- **PostgreSQL** avec extension **TimescaleDB**
- **npm** ou **yarn**

## 🗄️ Installation de TimescaleDB

### Sur Windows (avec PostgreSQL)

1. **Installer PostgreSQL** depuis [postgresql.org](https://www.postgresql.org/download/windows/)

2. **Installer TimescaleDB** :
   ```powershell
   # Télécharger TimescaleDB depuis https://docs.timescale.com/install/latest/self-hosted/
   # Ou utiliser pgAdmin pour installer l'extension
   ```

3. **Créer la base de données** :
   ```sql
   -- Se connecter à PostgreSQL
   psql -U postgres

   -- Créer la base de données
   CREATE DATABASE aquawatch;

   -- Se connecter à la base
   \c aquawatch

   -- Activer l'extension TimescaleDB
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   ```

### Sur Linux/macOS

```bash
# Installer PostgreSQL et TimescaleDB
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo apt-get install timescaledb-2-postgresql-14  # Ajuster la version PostgreSQL

# macOS (avec Homebrew)
brew install postgresql
brew install timescaledb

# Créer la base de données
createdb aquawatch
psql -U postgres -d aquawatch -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

### Alternative : Docker (recommandé)

```bash
# Lancer PostgreSQL avec TimescaleDB via Docker
docker run -d \
  --name timescaledb \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=aquawatch \
  timescale/timescaledb:latest-pg14

# Créer l'extension TimescaleDB
docker exec -it timescaledb psql -U postgres -d aquawatch -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

## 🚀 Installation du Projet

1. **Cloner ou télécharger le projet**

2. **Installer les dépendances** :
   ```bash
   # Installer toutes les dépendances (racine + tous les microservices)
   npm run install:all
   
   # Ou manuellement :
   npm install
   cd ingestion && npm install && cd ..
   cd alerts && npm install && cd ..
   cd api && npm install && cd ..
   cd scripts && npm install && cd ..
   ```

3. **Configurer les variables d'environnement** :
   
   Créer un fichier `.env` à la racine (ou dans chaque dossier de microservice) :
   ```env
   # Configuration TimescaleDB/PostgreSQL
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=aquawatch
   DB_USER=postgres
   DB_PASSWORD=postgres

   # Configuration MQTT
   MQTT_HOST=localhost
   MQTT_PORT=1883

   # Configuration API
   API_PORT=3000
   ```

## ▶️ Démarrage des Services

### Option 1 : Démarrer tous les services en parallèle

```bash
npm run start:all
```

### Option 2 : Démarrer chaque service dans un terminal séparé

**Terminal 1 - Microservice Ingestion (MQTT + TimescaleDB)** :
```bash
npm run start:ingestion
# ou
cd ingestion && npm start
```

**Terminal 2 - Microservice Alertes** :
```bash
npm run start:alerts
# ou
cd alerts && npm start
```

**Terminal 3 - Microservice API REST** :
```bash
npm run start:api
# ou
cd api && npm start
```

**Terminal 4 - Simulateur de Capteurs** :
```bash
npm run start:simulator
# ou
cd scripts && npm start
```

## 🧪 Test du Pipeline Complet

1. **Vérifier que TimescaleDB est démarré** :
   ```bash
   psql -U postgres -d aquawatch -c "SELECT version();"
   ```

2. **Démarrer le microservice Ingestion** (Terminal 1)

3. **Démarrer le microservice Alertes** (Terminal 2)

4. **Démarrer le microservice API REST** (Terminal 3)

5. **Démarrer le simulateur** (Terminal 4)

6. **Vérifier les données** :
   - Les mesures apparaissent dans la console du microservice Ingestion
   - Les alertes (si seuils dépassés) apparaissent dans la console du microservice Alertes
   - Consulter l'API REST :
     ```bash
     # Dernières mesures
     curl http://localhost:3000/latest-measurements
     
     # Historique des alertes
     curl http://localhost:3000/alerts
     
     # Santé de l'API
     curl http://localhost:3000/health
     ```

## 📡 Endpoints API REST

### `GET /health`
Vérifie l'état de l'API.

**Réponse** :
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### `GET /latest-measurements`
Récupère les dernières mesures de chaque capteur.

**Réponse** :
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "sensor_id": "sensor-1",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "latitude": 48.8566,
      "longitude": 2.3522,
      "ph": 7.2,
      "turbidity": 2.5,
      "temperature": 15.0,
      "conductivity": 800
    }
  ]
}
```

### `GET /alerts`
Récupère l'historique des alertes.

**Paramètres de requête** :
- `limit` (optionnel) : Nombre maximum d'alertes à retourner (défaut: 100)
- `sensor_id` (optionnel) : Filtrer par ID de capteur

**Exemple** :
```bash
curl "http://localhost:3000/alerts?limit=50&sensor_id=sensor-1"
```

**Réponse** :
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "sensor_id": "sensor-1",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "parameter": "ph",
      "value": 4.5,
      "threshold": 6.5,
      "severity": "CRITIQUE",
      "message": "pH hors norme: 4.50 pH (seuil: 6.5-8.5 pH)"
    }
  ]
}
```

## 📊 Seuils OMS (Organisation Mondiale de la Santé)

Le système vérifie les seuils suivants :

| Paramètre | Seuil Min | Seuil Max | Unité |
|-----------|-----------|-----------|-------|
| **pH** | 6.5 | 8.5 | pH |
| **Turbidité** | - | 5.0 | NTU |
| **Température** | 0 | 30 | °C |
| **Conductivité** | - | 2500 | µS/cm |

**Niveaux de sévérité** :
- **WARNING** : Valeur légèrement hors norme
- **CRITIQUE** : Valeur très anormale (ex: pH < 5 ou > 9, turbidité > 10 NTU)

## 🗂️ Structure du Projet

```
projetaqua/
├── ingestion/          # Microservice Ingestion (MQTT + TimescaleDB)
│   ├── server.js       # Serveur MQTT
│   ├── db.js           # Connexion et opérations TimescaleDB
│   └── package.json
├── alerts/             # Microservice Alertes
│   ├── service.js      # Service de vérification des seuils
│   ├── db.js           # Connexion et opérations TimescaleDB
│   └── package.json
├── api/                # Microservice API REST
│   ├── server.js       # Serveur Express
│   ├── db.js           # Connexion et opérations TimescaleDB
│   └── package.json
├── scripts/            # Scripts utilitaires
│   ├── simulator.js    # Simulateur de capteurs IoT
│   └── package.json
├── package.json        # Configuration racine
└── README.md           # Ce fichier
```

## 🔍 Capteurs Simulés

Le simulateur génère des données pour 3 capteurs :

1. **sensor-1** (Capteur Rivière Nord)
   - Localisation : Paris [48.8566, 2.3522]
   - Valeurs de base : pH 7.2, Temp 15°C, Turb 2.5 NTU, Cond 800 µS/cm

2. **sensor-2** (Capteur Rivière Sud)
   - Localisation : Lyon [45.7640, 4.8357]
   - Valeurs de base : pH 7.0, Temp 18°C, Turb 3.0 NTU, Cond 1200 µS/cm

3. **sensor-3** (Capteur Rivière Est)
   - Localisation : Marseille [43.2965, 5.3698]
   - Valeurs de base : pH 7.5, Temp 20°C, Turb 1.8 NTU, Cond 1500 µS/cm

**Fréquence d'envoi** : Toutes les 5 secondes

**Anomalies** : Le simulateur génère occasionnellement (5% de chance) des valeurs anormales pour tester le système d'alertes.

## 🐛 Dépannage

### Erreur de connexion à PostgreSQL
- Vérifier que PostgreSQL est démarré
- Vérifier les identifiants dans `.env`
- Tester la connexion : `psql -U postgres -d aquawatch`

### Erreur "create_hypertable"
- TimescaleDB n'est peut-être pas installé
- Le système fonctionnera en mode PostgreSQL standard (sans optimisations temporelles)
- Pour installer TimescaleDB, voir la section "Installation de TimescaleDB"

### Erreur de connexion MQTT
- Vérifier que le microservice Ingestion est démarré
- Vérifier le port MQTT (défaut: 1883)

### Aucune donnée dans l'API
- Vérifier que le simulateur est démarré
- Vérifier que le microservice Ingestion reçoit les messages MQTT
- Vérifier les logs de chaque service

## 📝 Notes Techniques

- **MQTT** : Utilise le broker intégré `aedes` (pas besoin de Mosquitto externe)
- **TimescaleDB** : Optimisé pour les données temporelles (time-series)
- **Architecture** : Microservices découplés, communication via MQTT et base de données partagée
- **Horodatage** : Toutes les mesures sont horodatées avec `TIMESTAMPTZ`

## 🚀 Prochaines Étapes

- Ajouter l'authentification JWT pour l'API
- Implémenter un vrai service d'envoi d'emails/SMS
- Ajouter un dashboard web en temps réel
- Implémenter des graphiques de tendances
- Ajouter la persistance des alertes dans un système de notification
- Déployer avec Docker Compose

## 📄 Licence

MIT

---

**AquaWatch-MS** - Surveillance de la qualité de l'eau en temps réel 🌊

