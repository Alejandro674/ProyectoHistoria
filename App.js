import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
// 1. IMPORTAMOS EL ALMACENAMIENTO
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- ESTILO RETRO ---
const drawnMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#ebe3cd" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#523735" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f1e6" }] },
  { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#c9b2a6" }] },
  { "featureType": "administrative.land_parcel", "elementType": "geometry.stroke", "stylers": [{ "color": "#dcd2be" }] },
  { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#dfd2ae" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#dfd2ae" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#93817c" }] },
  { "featureType": "poi.park", "elementType": "geometry.fill", "stylers": [{ "color": "#a5b076" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#f5f1e6" }] },
  { "featureType": "water", "elementType": "geometry.fill", "stylers": [{ "color": "#b9d3c2" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#92998d" }] }
];

const lugaresSorpresa = [
    "Tokio", "Roma", "Egipto", "Machu Picchu", "Londres", "Nueva York", "Paris", 
    "Antártida", "Grecia", "Turquía", "Isla de Pascua", "Stonehenge", "Petra", "Muralla China"
];

export default function App() {
  const [lugar, setLugar] = useState('');
  const [historia, setHistoria] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]); 
  const [menuVisible, setMenuVisible] = useState(false);
  
  const mapRef = useRef(null);

  // ⚠️ REVISA TU IP LOCAL
  const API_URL = 'http://192.168.0.12:5000/historia'; 
  const STORAGE_KEY = '@bitacora_viaje_v1'; // Nombre del archivo "JSON" interno

  // --- 2. CARGAR DATOS AL INICIAR LA APP ---
  useEffect(() => {
      cargarDatosGuardados();
  }, []);

  const cargarDatosGuardados = async () => {
      try {
          const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
          if (jsonValue != null) {
              setHistorial(JSON.parse(jsonValue));
              console.log("Bitácora recuperada con éxito");
          }
      } catch (e) {
          console.error("Error cargando bitácora:", e);
      }
  };

  // --- 3. GUARDAR DATOS EN EL CELULAR ---
  const guardarEnCelular = async (nuevoArray) => {
      try {
          const jsonValue = JSON.stringify(nuevoArray);
          await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
      } catch (e) {
          console.error("Error guardando:", e);
      }
  };

  const capitalizar = (str) => {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const buscarHistoria = async (lugarABuscar) => {
    const terminoRaw = lugarABuscar || lugar;
    if (!terminoRaw) return;

    const categoria = capitalizar(terminoRaw);
    setLoading(true);
    setMenuVisible(false);

    try {
      const response = await fetch(`${API_URL}?lugar=${terminoRaw}`);
      const data = await response.json();

      if (response.ok) {
        setHistoria(data);
        
        // ACTUALIZAR HISTORIAL Y GUARDAR
        const nuevoItem = { ...data, categoria: categoria };
        
        // Creamos una copia del historial actual para modificarla
        let nuevoHistorial = [...historial];
        
        // Verificamos si ya existe para no repetir
        const existe = nuevoHistorial.some(item => item.titulo === data.titulo);
        
        if (!existe) {
            nuevoHistorial = [nuevoItem, ...nuevoHistorial]; // Agregamos al principio
            setHistorial(nuevoHistorial); // Actualizamos visualmente
            guardarEnCelular(nuevoHistorial); // Guardamos en memoria permanente
        }

        const nuevaRegion = {
            latitude: data.coordenadas.latitude,
            longitude: data.coordenadas.longitude,
            latitudeDelta: 5.0, 
            longitudeDelta: 5.0,
        };
        mapRef.current.animateToRegion(nuevaRegion, 2000); 
      } else {
        Alert.alert("Error", "La IA no encontró nada.");
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Revisa la conexión con Python.");
    } finally {
      setLoading(false);
    }
  };

  const datoAleatorio = () => {
      const azar = lugaresSorpresa[Math.floor(Math.random() * lugaresSorpresa.length)];
      setLugar(azar); 
      buscarHistoria(azar); 
  };

  const viajarAlPasado = (item) => {
      setHistoria(item); 
      setMenuVisible(false); 
      const nuevaRegion = {
        latitude: item.coordenadas.latitude,
        longitude: item.coordenadas.longitude,
        latitudeDelta: 5.0,
        longitudeDelta: 5.0,
      };
      mapRef.current.animateToRegion(nuevaRegion, 1500);
  };

  const borrarHistorial = async () => {
      Alert.alert(
          "¿Borrar Bitácora?",
          "Perderás todos tus descubrimientos guardados.",
          [
              { text: "Cancelar", style: "cancel" },
              { text: "Borrar", style: "destructive", onPress: async () => {
                  setHistorial([]);
                  await AsyncStorage.removeItem(STORAGE_KEY);
              }}
          ]
      );
  };

  // Agrupar historial por países
  const obtenerHistorialAgrupado = () => {
      const grupos = {};
      historial.forEach(item => {
          if (!grupos[item.categoria]) {
              grupos[item.categoria] = [];
          }
          grupos[item.categoria].push(item);
      });
      return grupos;
  };

  const historialAgrupado = obtenerHistorialAgrupado();

  return (
    <View style={styles.container}>
      
      {/* MAPA */}
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={drawnMapStyle} 
        initialRegion={{
          latitude: 20.0, longitude: 0.0, latitudeDelta: 80, longitudeDelta: 80,
        }}
      >
        {historia && (
            <Marker
                coordinate={historia.coordenadas}
                title={historia.titulo}
                description={historia.anio}
                pinColor="brown" 
            >
                <Callout tooltip>
                    <View style={styles.bubble}>
                        <Text style={styles.bubbleTitle}>{historia.titulo}</Text>
                        <Text style={styles.bubbleDesc}>Toca para ver info</Text>
                    </View>
                </Callout>
            </Marker>
        )}
      </MapView>

      {/* BARRA SUPERIOR */}
      <View style={styles.topBar}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="journal" size={24} color="#fffcf5" /> 
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <TextInput
            style={styles.input}
            placeholder="Buscar lugar..."
            placeholderTextColor="#888"
            value={lugar}
            onChangeText={setLugar}
            />
            <TouchableOpacity style={styles.searchButton} onPress={() => buscarHistoria(lugar)} disabled={loading}>
            {loading ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="search" size={20} color="white" />}
            </TouchableOpacity>
          </View>
      </View>

      {/* INFO CARD */}
      {historia && (
        <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
                <Ionicons name="time" size={20} color="#8b5a2b" />
                <Text style={styles.cardYear}> {historia.anio}</Text>
            </View>
            <Text style={styles.cardTitle}>{historia.titulo}</Text>
            <Text style={styles.cardDesc}>{historia.descripcion}</Text>
        </View>
      )}

      {/* MENÚ (BITÁCORA GUARDADA) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.menuContainer}>
                
                <View style={styles.menuHeader}>
                    <Text style={styles.menuTitle}>Bitácora 🧭</Text>
                    <View style={{flexDirection: 'row'}}>
                        {/* Botón Borrar */}
                        <TouchableOpacity onPress={borrarHistorial} style={{marginRight: 15}}>
                            <Ionicons name="trash-outline" size={28} color="#8b5a2b" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMenuVisible(false)}>
                            <Ionicons name="close" size={30} color="#523735" />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity style={styles.randomButton} onPress={datoAleatorio}>
                    <Ionicons name="compass" size={24} color="white" style={{marginRight: 10}}/>
                    <Text style={styles.randomButtonText}>Descubrir al Azar</Text>
                </TouchableOpacity>

                <ScrollView style={{marginTop: 20}} showsVerticalScrollIndicator={false}>
                    {Object.keys(historialAgrupado).length === 0 ? (
                        <Text style={styles.emptyText}>Tu diario está vacío.{'\n'}¡Explora el mundo para guardar recuerdos!</Text>
                    ) : (
                        Object.keys(historialAgrupado).map((pais, index) => (
                            <View key={index} style={styles.groupContainer}>
                                <View style={styles.groupHeader}>
                                    <Ionicons name="map" size={18} color="#8b5a2b" />
                                    <Text style={styles.groupTitle}>{pais}</Text>
                                </View>

                                {historialAgrupado[pais].map((item, idx) => (
                                    <TouchableOpacity 
                                        key={idx} 
                                        style={styles.historyItem} 
                                        onPress={() => viajarAlPasado(item)}
                                    >
                                        <View style={styles.bulletPoint} />
                                        <View style={{flex: 1}}>
                                            <Text style={styles.historyTitle}>{item.titulo}</Text>
                                            <Text style={styles.historyYear}>{item.anio}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width: '100%', height: '100%' },
  
  // Header
  topBar: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  menuButton: { backgroundColor: '#8b5a2b', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 10, elevation: 5 },
  searchContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#fffcf5', borderRadius: 30, elevation: 5, paddingHorizontal: 15, paddingVertical: 5, alignItems: 'center', borderWidth: 1, borderColor: '#dcd2be', height: 45 },
  input: { flex: 1, fontSize: 16, color: '#523735' },
  searchButton: { backgroundColor: '#8b5a2b', padding: 5, borderRadius: 20, marginLeft: 5 },
  
  // Info Card
  infoCard: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#fffcf5', borderRadius: 15, padding: 20, elevation: 10, borderWidth: 2, borderColor: '#dcd2be' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  cardYear: { color: '#8b5a2b', fontWeight: 'bold', fontSize: 16 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#523735', marginBottom: 8, fontFamily: 'serif' },
  cardDesc: { fontSize: 15, color: '#6b5b55', lineHeight: 22, fontFamily: 'serif' },
  
  // Menú
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start' },
  menuContainer: { width: '85%', height: '100%', backgroundColor: '#f4f1ea', padding: 20, paddingTop: 50, borderRightWidth: 4, borderRightColor: '#d1c7b7' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#dcd2be', paddingBottom: 15 },
  menuTitle: { fontSize: 26, fontWeight: 'bold', color: '#523735', fontFamily: 'serif' },
  
  randomButton: { flexDirection: 'row', backgroundColor: '#8b5a2b', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  randomButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  // Estilos de Agrupación
  groupContainer: { marginBottom: 20, backgroundColor: '#fff', borderRadius: 10, padding: 10, elevation: 1 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  groupTitle: { fontSize: 18, fontWeight: 'bold', color: '#8b5a2b', marginLeft: 8, textTransform: 'uppercase' },
  
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  bulletPoint: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#c9b2a6', marginRight: 10, marginTop: 4 },
  historyTitle: { fontWeight: '600', color: '#523735', fontSize: 15 },
  historyYear: { color: '#999', fontSize: 12 },
  
  emptyText: { color: '#999', fontStyle: 'italic', marginTop: 20, textAlign: 'center' },
  
  // Callout
  bubble: { width: 150, backgroundColor: '#fffcf5', padding: 10, borderRadius: 5, borderColor: '#8b5a2b', borderWidth: 1 },
  bubbleTitle: { fontWeight: 'bold', fontSize: 12, color: '#523735' },
  bubbleDesc: { fontSize: 10, color: '#888' },
});