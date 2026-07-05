// LogiPulse — cities.js — All India cities with GPS coordinates

var INDIA_CITIES = [
    { name: 'Bengaluru',          state: 'Karnataka',           lat: 12.9716, lng: 77.5946 },
    { name: 'Thirthahalli',       state: 'Karnataka',           lat: 13.6913, lng: 75.2435 },
    { name: 'Mysuru',             state: 'Karnataka',           lat: 12.2958, lng: 76.6394 },
    { name: 'Mangaluru',          state: 'Karnataka',           lat: 12.9141, lng: 74.8560 },
    { name: 'Hubli',              state: 'Karnataka',           lat: 15.3647, lng: 75.1240 },
    { name: 'Shivamogga',         state: 'Karnataka',           lat: 13.9299, lng: 75.5681 },
    { name: 'Davangere',          state: 'Karnataka',           lat: 14.4644, lng: 75.9218 },
    { name: 'Belagavi',           state: 'Karnataka',           lat: 15.8497, lng: 74.4977 },
    { name: 'Mumbai',             state: 'Maharashtra',         lat: 19.0760, lng: 72.8777 },
    { name: 'Pune',               state: 'Maharashtra',         lat: 18.5204, lng: 73.8567 },
    { name: 'Nagpur',             state: 'Maharashtra',         lat: 21.1458, lng: 79.0882 },
    { name: 'Nashik',             state: 'Maharashtra',         lat: 19.9975, lng: 73.7898 },
    { name: 'Aurangabad',         state: 'Maharashtra',         lat: 19.8762, lng: 75.3433 },
    { name: 'Solapur',            state: 'Maharashtra',         lat: 17.6869, lng: 75.9064 },
    { name: 'Delhi',              state: 'Delhi',               lat: 28.6139, lng: 77.2090 },
    { name: 'Noida',              state: 'Uttar Pradesh',       lat: 28.5355, lng: 77.3910 },
    { name: 'Ghaziabad',          state: 'Uttar Pradesh',       lat: 28.6692, lng: 77.4538 },
    { name: 'Lucknow',            state: 'Uttar Pradesh',       lat: 26.8467, lng: 80.9462 },
    { name: 'Agra',               state: 'Uttar Pradesh',       lat: 27.1767, lng: 78.0081 },
    { name: 'Varanasi',           state: 'Uttar Pradesh',       lat: 25.3176, lng: 82.9739 },
    { name: 'Kanpur',             state: 'Uttar Pradesh',       lat: 26.4499, lng: 80.3319 },
    { name: 'Chennai',            state: 'Tamil Nadu',          lat: 13.0827, lng: 80.2707 },
    { name: 'Coimbatore',         state: 'Tamil Nadu',          lat: 11.0168, lng: 76.9558 },
    { name: 'Madurai',            state: 'Tamil Nadu',          lat:  9.9252, lng: 78.1198 },
    { name: 'Salem',              state: 'Tamil Nadu',          lat: 11.6643, lng: 78.1460 },
    { name: 'Tiruchirappalli',    state: 'Tamil Nadu',          lat: 10.7905, lng: 78.7047 },
    { name: 'Hyderabad',          state: 'Telangana',           lat: 17.3850, lng: 78.4867 },
    { name: 'Warangal',           state: 'Telangana',           lat: 17.9784, lng: 79.5941 },
    { name: 'Visakhapatnam',      state: 'Andhra Pradesh',      lat: 17.6868, lng: 83.2185 },
    { name: 'Vijayawada',         state: 'Andhra Pradesh',      lat: 16.5062, lng: 80.6480 },
    { name: 'Guntur',             state: 'Andhra Pradesh',      lat: 16.2995, lng: 80.4573 },
    { name: 'Kolkata',            state: 'West Bengal',         lat: 22.5726, lng: 88.3639 },
    { name: 'Howrah',             state: 'West Bengal',         lat: 22.5958, lng: 88.2636 },
    { name: 'Ahmedabad',          state: 'Gujarat',             lat: 23.0225, lng: 72.5714 },
    { name: 'Surat',              state: 'Gujarat',             lat: 21.1702, lng: 72.8311 },
    { name: 'Vadodara',           state: 'Gujarat',             lat: 22.3072, lng: 73.1812 },
    { name: 'Rajkot',             state: 'Gujarat',             lat: 22.3039, lng: 70.8022 },
    { name: 'Jaipur',             state: 'Rajasthan',           lat: 26.9124, lng: 75.7873 },
    { name: 'Jodhpur',            state: 'Rajasthan',           lat: 26.2389, lng: 73.0243 },
    { name: 'Udaipur',            state: 'Rajasthan',           lat: 24.5854, lng: 73.7125 },
    { name: 'Bikaner',            state: 'Rajasthan',           lat: 28.0229, lng: 73.3119 },
    { name: 'Indore',             state: 'Madhya Pradesh',      lat: 22.7196, lng: 75.8577 },
    { name: 'Bhopal',             state: 'Madhya Pradesh',      lat: 23.2599, lng: 77.4126 },
    { name: 'Jabalpur',           state: 'Madhya Pradesh',      lat: 23.1815, lng: 79.9864 },
    { name: 'Gwalior',            state: 'Madhya Pradesh',      lat: 26.2183, lng: 78.1828 },
    { name: 'Bhubaneswar',        state: 'Odisha',              lat: 20.2961, lng: 85.8245 },
    { name: 'Cuttack',            state: 'Odisha',              lat: 20.4625, lng: 85.8830 },
    { name: 'Patna',              state: 'Bihar',               lat: 25.5941, lng: 85.1376 },
    { name: 'Ranchi',             state: 'Jharkhand',           lat: 23.3441, lng: 85.3096 },
    { name: 'Jamshedpur',         state: 'Jharkhand',           lat: 22.8046, lng: 86.2029 },
    { name: 'Dhanbad',            state: 'Jharkhand',           lat: 23.7957, lng: 86.4304 },
    { name: 'Raipur',             state: 'Chhattisgarh',        lat: 21.2514, lng: 81.6296 },
    { name: 'Bhilai',             state: 'Chhattisgarh',        lat: 21.1938, lng: 81.3509 },
    { name: 'Guwahati',           state: 'Assam',               lat: 26.1445, lng: 91.7362 },
    { name: 'Chandigarh',         state: 'Chandigarh',          lat: 30.7333, lng: 76.7794 },
    { name: 'Amritsar',           state: 'Punjab',              lat: 31.6340, lng: 74.8723 },
    { name: 'Ludhiana',           state: 'Punjab',              lat: 30.9010, lng: 75.8573 },
    { name: 'Dehradun',           state: 'Uttarakhand',         lat: 30.3165, lng: 78.0322 },
    { name: 'Shimla',             state: 'Himachal Pradesh',    lat: 31.1048, lng: 77.1734 },
    { name: 'Jammu',              state: 'Jammu & Kashmir',     lat: 32.7266, lng: 74.8570 },
    { name: 'Srinagar',           state: 'Jammu & Kashmir',     lat: 34.0837, lng: 74.7973 },
    { name: 'Kochi',              state: 'Kerala',              lat:  9.9312, lng: 76.2673 },
    { name: 'Thiruvananthapuram', state: 'Kerala',              lat:  8.5241, lng: 76.9366 },
    { name: 'Kozhikode',          state: 'Kerala',              lat: 11.2588, lng: 75.7804 },
    { name: 'Thrissur',           state: 'Kerala',              lat: 10.5276, lng: 76.2144 },
    { name: 'Gorakhpur',          state: 'Uttar Pradesh',       lat: 26.7605, lng: 83.3731 },
    { name: 'Allahabad',          state: 'Uttar Pradesh',       lat: 25.4358, lng: 81.8463 },
    { name: 'Meerut',             state: 'Uttar Pradesh',       lat: 28.9845, lng: 77.7064 },
    { name: 'Bareilly',           state: 'Uttar Pradesh',       lat: 28.3670, lng: 79.4304 },
    { name: 'Amravati',           state: 'Maharashtra',         lat: 20.9374, lng: 77.7796 },
    { name: 'Kota',               state: 'Rajasthan',           lat: 25.2138, lng: 75.8648 }
];

// ---- Build city dropdown options ----
function buildCityDropdown(selectElementId, selectedName) {
    var sel = document.getElementById(selectElementId);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select City --</option>';

    var sorted = INDIA_CITIES.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(function (city) {
        var opt = document.createElement('option');
        opt.value = city.name;
        opt.dataset.lat   = city.lat;
        opt.dataset.lng   = city.lng;
        opt.dataset.state = city.state;
        opt.textContent   = city.name + ', ' + city.state;
        if (city.name === selectedName) opt.selected = true;
        sel.appendChild(opt);
    });
}

// ---- Get city coordinates by name ----
function getCityCoords(cityName) {
    return INDIA_CITIES.find(function (c) { return c.name === cityName; }) || null;
}