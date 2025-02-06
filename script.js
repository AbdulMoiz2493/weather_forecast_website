// Configuration
const API_KEY = 'b47fada7e77e4483cbedcbfe5ffd407e';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEMINI_API_KEY = 'AIzaSyCGytT1rXz-tX6yMCYSy8mFvkcHgEORPDk';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
let currentUnit = 'metric';
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let forecastData = [];
let currentCity = '';
let currentWeatherData = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    const citySearch = document.getElementById('citySearch');
    const toggleUnit = document.getElementById('toggleUnit');
    const currentWeather = document.getElementById('currentWeather');
    const forecastTable = document.getElementById('forecastTable');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    // Initialize charts if we're on the dashboard page
    if (document.getElementById('tempBarChart')) {
        initializeCharts();
    }

    // Event Listeners
    citySearch.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            try {
                const data = await fetchWeatherData(citySearch.value);
                updateWeatherWidget(data.current);
                updateTable(data.forecast);
                if (window.tempBarChart) {
                    updateCharts(data.forecast);
                }
            } catch (error) {
                alert(error.message);
            }
        }
    });

    toggleUnit.addEventListener('click', async () => {
        currentUnit = currentUnit === 'metric' ? 'imperial' : 'metric';
        if (citySearch.value) {
            try {
                const data = await fetchWeatherData(citySearch.value);
                updateWeatherWidget(data.current);
                updateTable(data.forecast);
                if (window.tempBarChart) {
                    updateCharts(data.forecast);
                }
            } catch (error) {
                alert(error.message);
            }
        }
    });

    prevPage?.addEventListener('click', () => {
        if (currentPage > 1) displayTablePage(currentPage - 1);
    });

    nextPage?.addEventListener('click', () => {
        const totalPages = Math.ceil(forecastData.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) displayTablePage(currentPage + 1);
    });

    document.getElementById('sortAscending')?.addEventListener('click', () => sortTemperatures(true));
    document.getElementById('sortDescending')?.addEventListener('click', () => sortTemperatures(false));
    document.getElementById('filterRainy')?.addEventListener('click', filterRainyDays);
    document.getElementById('findHottest')?.addEventListener('click', findHottestDay);

    if ("geolocation" in navigator) {
        showLoadingSpinner();
        navigator.geolocation.getCurrentPosition(async function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            await fetchAndUpdateWeather(`lat=${lat}&lon=${lon}`);
            hideLoadingSpinner();
        }, function(error) {
            console.error("Error getting location:", error);
            hideLoadingSpinner();
            alert("Unable to get your location. Please search for a city manually.");
        });
    } else {
        alert("Geolocation is not supported by your browser. Please search for a city manually.");
    }

    const chatInput = document.getElementById('chatInput');
    const sendMessage = document.getElementById('sendMessage');

    if (chatInput && sendMessage) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleChatMessage();
            }
        });

        sendMessage.addEventListener('click', handleChatMessage);
    }
});

// Chart instances
let tempBarChart;
let weatherPieChart;
let tempLineChart;

// Initialize charts
function initializeCharts() {
    // Bar Chart
    const barCtx = document.getElementById('tempBarChart').getContext('2d');
    tempBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.5)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '5-Day Temperature Forecast'
                }
            }
        }
    });

    // Pie Chart
    const pieCtx = document.getElementById('weatherPieChart').getContext('2d');
    weatherPieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Weather Conditions Distribution'
                }
            }
        }
    });

    // Line Chart
    const lineCtx = document.getElementById('tempLineChart').getContext('2d');
    tempLineChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature Trend',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Temperature Changes'
                }
            }
        }
    });
}

// Fetch weather data
async function fetchWeatherData(city) {
    try {
        const queryParam = city.includes('lat=') ? city : `q=${city}`;
        const currentResponse = await fetch(
            `${BASE_URL}/weather?${queryParam}&units=${currentUnit}&appid=${API_KEY}`
        );
        if (!currentResponse.ok) throw new Error('City not found');
        const currentData = await currentResponse.json();

        const forecastResponse = await fetch(
            `${BASE_URL}/forecast?${queryParam}&units=${currentUnit}&appid=${API_KEY}`
        );
        const forecastData = await forecastResponse.json();

        // Store the current city and weather data
        currentCity = currentData.name;
        currentWeatherData = { current: currentData, forecast: forecastData };

        return currentWeatherData;
    } catch (error) {
        throw new Error(error.message);
    }
}


function updateWeatherWidget(data) {
    const currentWeather = document.getElementById('currentWeather');
    if (!currentWeather) return;

    const temp = Math.round(data.main.temp);
    const description = data.weather[0].description;
    const icon = data.weather[0].icon;
    const cityName = data.name;

    if (document.querySelector('.weather-widget')) {
        currentWeather.innerHTML = `
            <h2 class="text-3xl font-bold mb-4">${cityName}</h2>
            <div class="flex justify-center items-center gap-8">
                <div>
                    <span class="text-6xl font-bold">${temp}°${currentUnit === 'metric' ? 'C' : 'F'}</span>
                </div>
                <div>
                    <img src="http://openweathermap.org/img/w/${icon}.png" alt="Weather Icon" class="w-16 h-16">
                    <p class="text-xl">${description}</p>
                </div>
            </div>
        `;


        const widget = document.querySelector('.weather-widget');
        widget.className = 'weather-widget p-8 rounded-lg shadow-lg mb-8 text-white';
        updateWidgetBackground(description, widget);
    } else {
        currentWeather.innerHTML = `
            <div class="text-center">
                <h3 class="text-xl font-semibold">${cityName}</h3>
                <div class="flex justify-center items-center gap-4 mt-2">
                    <span class="text-2xl">${temp}°${currentUnit === 'metric' ? 'C' : 'F'}</span>
                    <img src="http://openweathermap.org/img/w/${icon}.png" alt="Weather Icon" class="w-8 h-8">
                    <span class="text-lg">${description}</span>
                </div>
            </div>
        `;
    }
}

function updateWidgetBackground(description, widget) {
    if (description.includes('clear')) {
        widget.classList.add('sunny');
    } else if (description.includes('cloud')) {
        widget.classList.add('cloudy');
    } else if (description.includes('rain') || description.includes('drizzle')) {
        widget.classList.add('rainy');
    } else if (description.includes('snow')) {
        widget.classList.add('snow');
    }
}

// Update charts
function updateCharts(forecast) {
    const dailyData = forecast.list.filter((item, index) => index % 8 === 0);
    
    // Update Bar Chart
    tempBarChart.data.labels = dailyData.map(item => 
        new Date(item.dt * 1000).toLocaleDateString()
    );
    tempBarChart.data.datasets[0].data = dailyData.map(item => item.main.temp);
    tempBarChart.update();

    // Update Pie Chart
    const weatherTypes = {};
    forecast.list.forEach(item => {
        const type = item.weather[0].main;
        weatherTypes[type] = (weatherTypes[type] || 0) + 1;
    });
    
    weatherPieChart.data.labels = Object.keys(weatherTypes);
    weatherPieChart.data.datasets[0].data = Object.values(weatherTypes);
    weatherPieChart.update();

    // Update Line Chart
    tempLineChart.data.labels = dailyData.map(item => 
        new Date(item.dt * 1000).toLocaleDateString()
    );
    tempLineChart.data.datasets[0].data = dailyData.map(item => item.main.temp);
    tempLineChart.update();
}

// Update forecast table
function updateTable(forecast) {
    forecastData = forecast.list;
    displayTablePage(1);
}

function displayTablePage(page) {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = forecastData.slice(start, end);
    const forecastTable = document.getElementById('forecastTable');

    forecastTable.innerHTML = pageData.map(item => `
        <tr class="border-b">
            <td class="p-2">${new Date(item.dt * 1000).toLocaleDateString()}</td>
            <td class="p-2">${Math.round(item.main.temp)}°${currentUnit === 'metric' ? 'C' : 'F'}</td>
            <td class="p-2">${item.weather[0].description}</td>
            <td class="p-2">${item.main.humidity}%</td>
            <td class="p-2">${item.wind.speed} ${currentUnit === 'metric' ? 'm/s' : 'mph'}</td>
        </tr>
    `).join('');

    currentPage = page;
    const totalPages = Math.ceil(forecastData.length / ITEMS_PER_PAGE);
    const pageInfo = document.getElementById('pageInfo');
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    if (prevPage && nextPage) {
        prevPage.disabled = currentPage === 1;
        nextPage.disabled = currentPage === totalPages;
    }
}

// Chat functionality
async function handleChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (message) {
        addMessageToChat('user', message);
        await generateResponse(message);
        chatInput.value = '';
    }
}

function addMessageToChat(sender, message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `p-3 rounded-lg ${sender === 'user' ? 'user bg-blue-100 ml-auto' : 'assistant bg-gray-100 mr-auto'}`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function generateResponse(message) {
    const messageLower = message.toLowerCase();

    if (messageLower.includes('weather') && currentWeatherData) {
        // Handle weather-related queries
        const response = generateWeatherResponse(messageLower);
        addMessageToChat('assistant', response);
    } else {
        // Use Gemini API for non-weather queries
        try {
            const response = await fetchGeminiResponse(message);
            addMessageToChat('assistant', response);
        } catch (error) {
            console.error('Error fetching Gemini response:', error);
            addMessageToChat('assistant', 'I apologize, but I encountered an error while processing your request.');
        }
    }
}

function generateWeatherResponse(messageLower) {
    if (messageLower.includes('temperature')) {
        const temp = Math.round(currentWeatherData.current.main.temp);
        return `The current temperature in ${currentCity} is ${temp}°${currentUnit === 'metric' ? 'C' : 'F'}.`;
    } else if (messageLower.includes('condition')) {
        const description = currentWeatherData.current.weather[0].description;
        return `The current weather condition in ${currentCity} is ${description}.`;
    } else if (messageLower.includes('humidity')) {
        const humidity = currentWeatherData.current.main.humidity;
        return `The current humidity in ${currentCity} is ${humidity}%.`;
    } else if (messageLower.includes('wind')) {
        const windSpeed = currentWeatherData.current.wind.speed;
        return `The current wind speed in ${currentCity} is ${windSpeed} ${currentUnit === 'metric' ? 'm/s' : 'mph'}.`;
    } else {
        return `Here's a summary of the weather in ${currentCity}: 
                Temperature: ${Math.round(currentWeatherData.current.main.temp)}°${currentUnit === 'metric' ? 'C' : 'F'}, 
                Condition: ${currentWeatherData.current.weather[0].description}, 
                Humidity: ${currentWeatherData.current.main.humidity}%, 
                Wind Speed: ${currentWeatherData.current.wind.speed} ${currentUnit === 'metric' ? 'm/s' : 'mph'}.`;
    }
}

async function fetchGeminiResponse(message) {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: message
                        }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch response from Gemini API');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Data manipulation functions
function sortTemperatures(ascending = true) {
    const sortedData = [...forecastData].sort((a, b) => {
        return ascending ? a.main.temp - b.main.temp : b.main.temp - a.main.temp;
    });
    updateTable({ list: sortedData });
}

function filterRainyDays() {
    const rainyDays = forecastData.filter(item => 
        item.weather[0].main.toLowerCase().includes('rain')
    );
    updateTable({ list: rainyDays });
}

function findHottestDay() {
    const hottestDay = forecastData.reduce((prev, current) => 
        (prev.main.temp > current.main.temp) ? prev : current
    );
    updateTable({ list: [hottestDay] });
}

// Loading spinner functions
function showLoadingSpinner() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.classList.remove('hidden');
    }
}

function hideLoadingSpinner() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
        loadingSpinner.classList.add('hidden');
    }
}

async function fetchAndUpdateWeather(query) {
    showLoadingSpinner();
    try {
        const data = await fetchWeatherData(query);
        updateWeatherWidget(data.current);
        updateTable(data.forecast);
        if (window.tempBarChart) {
            updateCharts(data.forecast);
        }
    } catch (error) {
        alert(error.message);
    } finally {
        hideLoadingSpinner();
    }
}

// Initialize chat
addMessageToChat('assistant', 'Hello! I can provide you with weather information. Please enter the name of a city to get started.');