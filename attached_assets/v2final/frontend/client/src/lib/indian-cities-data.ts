/**
 * Indian States and Cities Data
 * Source: https://github.com/ajayrandhawa/Indian-States-Cities-Database
 * 
 * This file is auto-generated from cities-data.json
 */

import { CITIES_DATA } from './cities-data';

export interface StateCityData {
  state: string;
  cities: string[];
}

// Parse cities from pipe-separated string
function parseCities(cityString: string): string[] {
  if (!cityString || cityString.trim() === "") return [];
  return cityString
    .split("|")
    .map((city) => city.trim())
    .filter((city) => city.length > 0);
}

// Build complete state-city mapping
export const INDIAN_STATES_CITIES: StateCityData[] = CITIES_DATA.states.map((state: string, index: number) => {
  const cityIndex = index + 1; // Cities array starts at index 1
  const citiesString = CITIES_DATA.cities[cityIndex] || "";
  return {
    state,
    cities: parseCities(citiesString),
  };
});

// Get cities for a specific state
export function getCitiesForState(stateName: string): string[] {
  const stateData = INDIAN_STATES_CITIES.find(
    (sc) => sc.state.toLowerCase() === stateName.toLowerCase()
  );
  return stateData?.cities || [];
}

// Get all states
export function getAllStates(): string[] {
  return CITIES_DATA.states;
}

// Get all cities (flattened, sorted, unique)
export function getAllCities(): string[] {
  const allCities: string[] = [];
  INDIAN_STATES_CITIES.forEach(({ cities }) => {
    allCities.push(...cities);
  });
  return [...new Set(allCities)].sort();
}

// Get state by city name (useful for reverse lookup)
export function getStateByCity(cityName: string): string | null {
  const stateData = INDIAN_STATES_CITIES.find(({ cities }) =>
    cities.some((city) => city.toLowerCase() === cityName.toLowerCase())
  );
  return stateData?.state || null;
}
