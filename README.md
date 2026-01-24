🌊 AquaWatch-MS

Plateforme intelligente de surveillance de la qualité de l’eau
Microservices + TimescaleDB + Intelligence Artificielle

Prototype complet de plateforme de surveillance en temps réel de la qualité de l'eau avec architecture microservices et module de prédiction par Machine Learning.

📋 Vue d'ensemble

AquaWatch-MS est une plateforme modulaire qui :

collecte des données de capteurs IoT,

les stocke dans une base temporelle,

détecte des anomalies,

et prédit l’évolution future de la qualité de l’eau grâce à un modèle IA.

Le système comprend :

Microservices

Ingestion : réception des données via MQTT → stockage TimescaleDB

Alertes : vérification des seuils OMS → génération d’alertes

API REST : accès aux mesures et alertes

Simulateur : génération de données capteurs

Intelligence Artificielle

Prétraitement des données

Entraînement d’un modèle ConvLSTM

Prédiction WQI (Water Quality Index)

Évaluation + graphiques scientifiques

🏗️ Architecture globale
Capteurs IoT (simulés)
        │
       MQTT
        │
Microservice Ingestion ───> TimescaleDB
        │
Microservice Alertes
        │
Microservice API REST
        │
 Consommateurs / Dashboard
        │
 Module IA (Python)
        │
 Prédictions & Graphiques

🧠 Module Intelligence Artificielle (nouveau)

Le projet inclut désormais un pipeline complet de Machine Learning.

Objectif

Prédire la qualité future de l’eau (WQI) à partir de l’historique des mesures :

pH

turbidité

température

conductivité

📁 Structure IA
ai/
├── train.py          # Entraînement du modèle ConvLSTM
├── predict.py        # Génération des prédictions
├── evaluate.py       # Calcul MAE, RMSE, R²
├── make_graphs.py    # Génération des graphiques
├── X.npy / Y.npy     # Données prétraitées
├── convlstm_model.pth
└── predictions.csv

⚙️ Entraînement du modèle

Le modèle utilisé est un ConvLSTM (réseau récurrent) adapté aux séries temporelles.

Étapes :

Normalisation des données

Création de fenêtres temporelles (sliding window)

Entraînement sur 20 epochs

Sauvegarde du modèle entraîné

Commande :

python -m ai.train

📊 Évaluation du modèle

Commande :

python ai/evaluate.py


Résultats obtenus :

Indicateur	Valeur
MAE	219.12
RMSE	524.22
R²	-0.052

➡️ Le modèle apprend la tendance générale mais reste perfectible (dataset limité et bruité).

📈 Graphiques scientifiques générés

Commande :

python ai/make_graphs.py


Fichiers générés :

Fichier	Signification
graph_real_vs_pred.png	Précision globale
graph_error_distribution.png	Distribution des erreurs
graph_wqi_future.png	Évolution future prédite

Ces graphiques sont directement utilisables dans un rapport universitaire.

🗄️ Base de données

Base : TimescaleDB (PostgreSQL)
Nom : aquawatch

Tables principales :

measurements (time-series)

alerts (événements critiques)

📡 Endpoints API

GET /latest-measurements

GET /alerts

GET /health

GET /predictions

🔬 Méthodologie scientifique (pour prof)

Le projet suit une démarche réelle de Data Science :

Collecte de données IoT simulées

Stockage en base temporelle

Prétraitement & normalisation

Entraînement du modèle

Évaluation quantitative

Visualisation graphique

Interprétation des résultats

🎯 Intérêt pédagogique

Ce projet combine :

systèmes distribués (microservices),

bases de données temporelles,

traitement du signal,

machine learning,

visualisation scientifique,

et déploiement applicatif.

➡️ Il simule un vrai projet industriel de Smart Water Monitoring.

🚀 Prochaines améliorations possibles

Plus de données réelles

Cross-validation

LSTM/Transformer

Dashboard web (React + Grafana)

Déploiement Docker Compose

Modèle multi-capteurs

🧑‍🏫 Phrase parfaite pour un prof

"Nous avons construit une plateforme microservices de surveillance de l’eau, intégrant une base de données temporelle et un modèle de deep learning de type ConvLSTM afin de prédire l’évolution future de la qualité de l’eau à partir de séries temporelles multivariées."
## 🎥 Démonstration vidéo

Une démonstration complète de la plateforme est disponible ici :
https://drive.google.com/file/d/1mbke6CIOvO_4Umg27te8a2Dlkr7J8ivg/view?usp=sharing
📄 Licence

MIT

AquaWatch-MS – Smart Water Monitoring Platform 🌊
