import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, earthMesh, satellites = [], controls, unit = 1000, directionalLight, earthMaterial, instanceCount, instancedSatellites, satelliteNames = [];

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

    const satGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const satMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            attribute float visibility;
            attribute vec3 color;
            varying float vVisibility;
            varying vec3 vColor;
        
            void main() {
                vVisibility = visibility;
                vColor = color;
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying float vVisibility;
            varying vec3 vColor;
        
            void main() {
                if (vVisibility < 0.5) discard;
                gl_FragColor = vec4(vColor, 1.0);
            }
        `,
        transparent: true
    });    

    instanceCount = 14214; // Le nombre de satellites
    instancedSatellites = new THREE.InstancedMesh(satGeometry, satMaterial, instanceCount);
    scene.add(instancedSatellites); // Ajoutez ceci une seule fois

    const visibility = new Float32Array(instanceCount).fill(1); // 1 pour visible, 0 pour invisible
    const visibilityAttr = new THREE.InstancedBufferAttribute(visibility, 1);
    instancedSatellites.geometry.setAttribute('visibility', visibilityAttr);    

    const colors = new Float32Array(instanceCount * 3); // 3 composantes de couleur pour chaque satellite
    const colorAttribute = new THREE.InstancedBufferAttribute(colors, 3);
    instancedSatellites.geometry.setAttribute('color', colorAttribute);

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

    camera.position.set(68, 15, 68);
    controls.update();
}


function animate() {
    requestAnimationFrame(animate);

    updateSunPosition();

    renderer.render(scene, camera);
    controls.update();
}

function getAllSatellites() {
    fetch(`http://localhost:3000/api/get-sat`)
        .then(response => response.json())
        .then(data => {
            satellites = data;
            generateSatellites(satellites);
        })
        .catch(error => console.error(error));
}


function updateSatellites() {
    fetch(`/api/update-sat`, { method: 'POST' })
        .then(response => response.text())
        .then(data => console.log(data))
        .catch(error => console.error(error));
}

async function generateSatellites(satellites) {
    satelliteNames = satellites.map(sat => sat.name);
    const tempObject = new THREE.Object3D();
    const colorAttribute = instancedSatellites.geometry.attributes.color;

    for (let i = 0; i < satellites.length; i++) {
        const sat = satellites[i];

        if (sat.coords === null || sat.coords === undefined || sat.coords.x === null || sat.coords.y === null || sat.coords.z === null) {
            continue;
        }

        tempObject.position.set(sat.coords.x, sat.coords.y, sat.coords.z);
        tempObject.updateMatrix();

        let color;
        if ((sat.name).includes('ISS (ZARYA)') || (sat.name).includes('ISS (NAUKA)')) {
            color = new THREE.Color(0xff0000); // Rouge pour l'ISS
        } else if ((sat.name).includes('STARLINK')) {
            color = new THREE.Color(0x0000ff); // Bleu pour Starlink
        } else {
            color = new THREE.Color(0x00ff00); // Couleur par défaut pour les autres satellites
        }

        colorAttribute.setXYZ(i, color.r, color.g, color.b);
        instancedSatellites.setMatrixAt(i, tempObject.matrix);
    }

    colorAttribute.needsUpdate = true;
    instancedSatellites.instanceMatrix.needsUpdate = true;
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
    const visualizationElement = document.getElementById('visualization');

    camera.aspect = visualizationElement.clientWidth / visualizationElement.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(visualizationElement.clientWidth, visualizationElement.clientHeight);
}

function toggleSatellitesVisibility(colorToToggle, isVisible) {
    const color = new THREE.Color(colorToToggle);
    const visibilityArray = instancedSatellites.geometry.attributes.visibility.array;
    const colorAttribute = instancedSatellites.geometry.attributes.color;

    for (let i = 0; i < instanceCount; i++) {
        const currentColor = new THREE.Color(
            colorAttribute.getX(i),
            colorAttribute.getY(i),
            colorAttribute.getZ(i)
        );

        if (currentColor.equals(color)) {
            visibilityArray[i] = isVisible ? 1 : 0; // Mettre à jour la visibilité
        }
    }

    instancedSatellites.geometry.attributes.visibility.needsUpdate = true;
}

function updateSuggestions(value) {
    const suggestions = document.getElementById('suggestions');
    suggestions.innerHTML = ''; // Effacer les suggestions existantes

    const filteredSatellites = satellites.filter(sat => 
        sat.name.toLowerCase().includes(value.toLowerCase())
    );

    filteredSatellites.forEach(sat => {
        const option = document.createElement('option');
        option.value = sat.name;
        suggestions.appendChild(option);
    });
}

function findSatelliteByName(name) {
    return satellites.find(sat => sat.name === name);
}

function zoomOnSatellite(satellite) {
    if (!satellite) return;

    // Calculer une nouvelle position pour la caméra
    // Cette partie dépend de la façon dont votre scène est configurée
    const newPosition = new THREE.Vector3(satellite.coords.x, satellite.coords.y, satellite.coords.z);
    newPosition.multiplyScalar(1.2); // Ajustez ce multiplicateur selon vos besoins

    // Déplacer la caméra vers cette nouvelle position
    camera.position.set(newPosition.x, newPosition.y, newPosition.z);
    controls.target.set(satellite.coords.x, satellite.coords.y, satellite.coords.z);

    // Mettre à jour les contrôles de la caméra
    controls.update();
}

function resetCamera() {
    camera.position.set(68, 15, 68);
    controls.update();
}

window.addEventListener('resize', onWindowResize, false);

window.onload = function() {
    let opened = false;

    document.addEventListener('click', function(event) {
        const panelHandle = document.querySelector('.panel-handle');
        const panel = document.getElementById('panel');

        if (event.target === panelHandle) {
            panel.classList.toggle('panel-active');
            if (opened) {
                panel.style.backgroundColor = 'unset';
                opened = false;
            } else {
                panel.style.backgroundColor = 'white';
                opened = true;
            }
        }
    });  

    const starlinksSat = document.getElementById('update-starlinks-sat');
    
    starlinksSat.addEventListener('click', function() {
        if (starlinksSat.dataset.showed === 'false') {
            toggleSatellitesVisibility(0x0000ff, true);
            starlinksSat.dataset.showed = 'true';
            starlinksSat.innerHTML = 'Hide Starlinks';
        } else {
            toggleSatellitesVisibility(0x0000ff, false);
            starlinksSat.dataset.showed = 'false';
            starlinksSat.innerHTML = 'Show Starlinks';
        }
    });

    const issSat = document.getElementById('update-iss-sat');

    issSat.addEventListener('click', function() {
        if (issSat.dataset.showed === 'false') {
            toggleSatellitesVisibility(0xff0000, true);
            issSat.dataset.showed = 'true';
            issSat.innerHTML = 'Hide ISS';
        } else {
            toggleSatellitesVisibility(0xff0000, false);
            issSat.dataset.showed = 'false';
            issSat.innerHTML = 'Show ISS';
        }
    });

    const otherSat = document.getElementById('update-other-sat');

    otherSat.addEventListener('click', function() {
        if (otherSat.dataset.showed === 'false') {
            toggleSatellitesVisibility(0x00ff00, true);
            otherSat.dataset.showed = 'true';
            otherSat.innerHTML = 'Hide other satellites';
        } else {
            toggleSatellitesVisibility(0x00ff00, false);
            otherSat.dataset.showed = 'false';
            otherSat.innerHTML = 'Show other satellites';
        }
    });

    document.getElementById('searchInput').addEventListener('input', function(e) {
        updateSuggestions(e.target.value);
    });    

    document.getElementById('searchButton').addEventListener('click', function() {
        const satelliteName = document.getElementById('searchInput').value;
        const satellite = findSatelliteByName(satelliteName);
        if (satellite) {
            zoomOnSatellite(satellite);
        } else {
            console.log("Satellite non trouvé.");
        }
    });

    document.getElementById('reset-camera').addEventListener('click', function() {
        resetCamera();
    }); 
    
};

init();
animate();
getAllSatellites();
//updateSatellites();