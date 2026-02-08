import { useState, useEffect } from "react"

export interface LocationData {
  city?: string
  state?: string
  country?: string
  timezone?: string
}

export interface SmartDefaults {
  currency: string
  dateFormat: string
  phoneFormat: string
  location?: LocationData
}

const DEFAULT_LOCALE = {
  currency: "INR",
  dateFormat: "DD/MM/YYYY",
  phoneFormat: "+91",
}

export function useSmartDefaults() {
  const [defaults, setDefaults] = useState<SmartDefaults>({
    ...DEFAULT_LOCALE,
  })
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt">("prompt")

  useEffect(() => {
    // Get location with permission
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Reverse geocoding to get city (using a free service)
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
            )
            const data = await response.json()
            
            setDefaults((prev) => ({
              ...prev,
              location: {
                city: data.city || data.locality,
                state: data.principalSubdivision,
                country: data.countryName,
              },
            }))
            setLocationPermission("granted")
          } catch (error) {
            console.error("Failed to get location data:", error)
            setLocationPermission("denied")
          }
        },
        () => {
          setLocationPermission("denied")
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000, // 5 minutes cache
        }
      )
    }
  }, [])

  const requestLocation = () => {
    if (navigator.geolocation && locationPermission === "prompt") {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
            )
            const data = await response.json()
            
            setDefaults((prev) => ({
              ...prev,
              location: {
                city: data.city || data.locality,
                state: data.principalSubdivision,
                country: data.countryName,
              },
            }))
            setLocationPermission("granted")
          } catch (error) {
            console.error("Failed to get location data:", error)
          }
        },
        () => {
          setLocationPermission("denied")
        }
      )
    }
  }

  return {
    defaults,
    locationPermission,
    requestLocation,
  }
}

