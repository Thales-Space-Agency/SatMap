import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, earthMesh, satellites = [], controls, unit = 1000, directionalLight, earthMaterial, instanceCount, instancedSatellites;

function init() {

    // Initialiser la scène, la caméra et le renderer
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const visualizationElement = document.getElementById('visualization');
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(visualizationElement.clientWidth, visualizationElement.clientHeight);
    visualizationElement.appendChild(renderer.domElement);
    

    // Ajuste la caméra
    camera.aspect = visualizationElement.clientWidth / visualizationElement.clientHeight;
    camera.updateProjectionMatrix();

    document.body.appendChild(renderer.domElement);

    const satGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const satMaterial = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors });

    instanceCount = 14214; // Le nombre de satellites
    instancedSatellites = new THREE.InstancedMesh(satGeometry, satMaterial, instanceCount);
    scene.add(instancedSatellites); // Ajoutez ceci une seule fois

    // Positionner la lumière directionnelle (Soleil)
    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(directionalLight);

    // Lumière ambiante
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const loader = new THREE.TextureLoader();

    // Créer une sphère pour représenter la Terre
    const earthRadius = 6371 / unit; // Rayon de la Terre en unités 3D
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 32, 32);

    earthMaterial = new THREE.MeshPhongMaterial({
        map: loader.load('./earth_day.jpeg'),
        normalMap: loader.load('./earth_normal.jpeg'),
        specularMap: loader.load('./earth_specular.jpeg'),
    });

    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.rotation.y = getEarthRotationAngle() * (Math.PI / 180);
    scene.add(earthMesh);

    controls = new OrbitControls(camera, renderer.domElement);

    camera.position.set(0, 20, 20);
    controls.update();
}


function animate() {
    requestAnimationFrame(animate);

    updateSunPosition();

    renderer.render(scene, camera);
    controls.update();
}

function getAllSatellites() {
    fetch(`:3001/api/get-sat`)
        .then(response => response.json())
        .then(data => {
            satellites = data;
            generateSatellites(satellites);
        })
        .catch(error => console.error(error));
}


function updateSatellites() {
    fetch(`:3001/api/update-sat`, { method: 'POST' })
        .then(response => response.text())
        .then(data => console.log(data))
        .catch(error => console.error(error));
}

async function generateSatellites(satellites) {
    const tempObject = new THREE.Object3D();
    for (let i = 0; i < satellites.length; i++) {
        const sat = satellites[i];
        let color = new THREE.Color();

        if (sat.coords === null || sat.coords === undefined || sat.coords.x === null || sat.coords.y === null || sat.coords.z === null) {
            continue;
        }

        tempObject.position.set(sat.coords.x, sat.coords.y, sat.coords.z);
        tempObject.updateMatrix();

        if ((sat.name).includes('ISS (ZARYA)') || (sat.name).includes('ISS (NAUKA')) {
            color.set(0xff0000); // Rouge pour l'ISS
        } else if ((sat.name).includes('STARLINK')) {
            color.set(0x0000ff); // Bleu pour Starlink
        } else {
            color.set(0x00ff00); // Couleur par défaut pour les autres satellites
        }

        instancedSatellites.setColorAt(i, color); // Définir la couleur
        instancedSatellites.setMatrixAt(i, tempObject.matrix);
    }

    // Mettre à jour l'instance
    instancedSatellites.instanceMatrix.needsUpdate = true;
    instancedSatellites.instanceColor.needsUpdate = true;
}

function getEarthRotationAngle() {
    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const seconds = now.getUTCSeconds();

    // Convertir l'heure actuelle en fraction de journée
    const fractionOfDay = (hours + minutes / 60 + seconds / 3600) / 24;

    // Calculer l'angle de rotation de la Terre
    return fractionOfDay * 360; // en degrés
}

function updateSunPosition() {
    const date = new Date();
    const latitude = 47.151920; // Votre latitude
    const longitude = 1.663480; // Votre longitude
    const sunPosition = SunCalc.getPosition(date, latitude, longitude);

    const sunVector = new THREE.Vector3(
        Math.cos(sunPosition.azimuth) * Math.cos(sunPosition.altitude),
        Math.sin(sunPosition.altitude),
        Math.sin(sunPosition.azimuth) * Math.cos(sunPosition.altitude)
    );

    directionalLight.position.copy(sunVector);
}

function onWindowResize() {
    const panelElement = document.getElementById('panel');
    const visualizationElement = document.getElementById('visualization');
    
    const panelWidth = window.innerWidth * 0.2;  // 20% de la largeur de la fenêtre
    const visualizationWidth = window.innerWidth * 0.8;  // 80% de la largeur de la fenêtre

    panelElement.style.width = `${panelWidth}px`;
    visualizationElement.style.width = `${visualizationWidth}px`;

    camera.aspect = visualizationElement.clientWidth / visualizationElement.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(visualizationElement.clientWidth, visualizationElement.clientHeight);
}


init();
animate();
getAllSatellites();
//updateSatellites();

window.addEventListener('resize', onWindowResize, false);