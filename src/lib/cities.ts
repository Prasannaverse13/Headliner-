export type Region =
  | "north-america"
  | "latin-america"
  | "europe"
  | "africa"
  | "middle-east"
  | "asia"
  | "oceania";

export type WorldCity = { city: string; country: string; lat: number; lng: number; region: Region };

export const REGION_LABELS: Record<Region, string> = {
  "north-america": "North America",
  "latin-america": "Latin America",
  europe: "Europe",
  africa: "Africa",
  "middle-east": "Middle East",
  asia: "Asia",
  oceania: "Oceania",
};

const c = (region: Region, country: string, rows: [string, number, number][]): WorldCity[] =>
  rows.map(([city, lat, lng]) => ({ city, country, lat, lng, region }));

/** Candidate tour cities, worldwide. The agent scores every one against the act's fans. */
export const WORLD_CITIES: WorldCity[] = [
  ...c("north-america", "US", [
    ["New York", 40.71, -74.01], ["Los Angeles", 34.05, -118.24], ["Chicago", 41.88, -87.63], ["Houston", 29.76, -95.37],
    ["Atlanta", 33.75, -84.39], ["Miami", 25.76, -80.19], ["Dallas", 32.78, -96.8], ["Seattle", 47.61, -122.33],
    ["Boston", 42.36, -71.06], ["San Francisco", 37.77, -122.42], ["Austin", 30.27, -97.74], ["Denver", 39.74, -104.99],
    ["Phoenix", 33.45, -112.07],
  ]),
  ...c("north-america", "CA", [["Toronto", 43.65, -79.38], ["Vancouver", 49.28, -123.12], ["Montreal", 45.5, -73.57]]),
  ...c("latin-america", "MX", [["Mexico City", 19.43, -99.13], ["Monterrey", 25.69, -100.32], ["Guadalajara", 20.66, -103.35]]),
  ...c("latin-america", "CO", [["Bogotá", 4.71, -74.07], ["Medellín", 6.24, -75.58]]),
  ...c("latin-america", "PE", [["Lima", -12.05, -77.04]]),
  ...c("latin-america", "CL", [["Santiago", -33.45, -70.67]]),
  ...c("latin-america", "AR", [["Buenos Aires", -34.6, -58.38]]),
  ...c("latin-america", "BR", [["São Paulo", -23.55, -46.63], ["Rio de Janeiro", -22.91, -43.17]]),
  ...c("latin-america", "UY", [["Montevideo", -34.9, -56.16]]),
  ...c("latin-america", "EC", [["Quito", -0.18, -78.47]]),
  ...c("latin-america", "PA", [["Panama City", 8.98, -79.52]]),
  ...c("latin-america", "PR", [["San Juan", 18.47, -66.11]]),
  ...c("europe", "GB", [["London", 51.51, -0.13], ["Manchester", 53.48, -2.24]]),
  ...c("europe", "IE", [["Dublin", 53.35, -6.26]]),
  ...c("europe", "FR", [["Paris", 48.86, 2.35]]),
  ...c("europe", "DE", [["Berlin", 52.52, 13.4], ["Munich", 48.14, 11.58], ["Hamburg", 53.55, 9.99]]),
  ...c("europe", "NL", [["Amsterdam", 52.37, 4.9]]),
  ...c("europe", "BE", [["Brussels", 50.85, 4.35]]),
  ...c("europe", "ES", [["Madrid", 40.42, -3.7], ["Barcelona", 41.39, 2.17]]),
  ...c("europe", "PT", [["Lisbon", 38.72, -9.14]]),
  ...c("europe", "IT", [["Rome", 41.9, 12.5], ["Milan", 45.46, 9.19]]),
  ...c("europe", "AT", [["Vienna", 48.21, 16.37]]),
  ...c("europe", "CH", [["Zurich", 47.38, 8.54]]),
  ...c("europe", "DK", [["Copenhagen", 55.68, 12.57]]),
  ...c("europe", "SE", [["Stockholm", 59.33, 18.07]]),
  ...c("europe", "NO", [["Oslo", 59.91, 10.75]]),
  ...c("europe", "FI", [["Helsinki", 60.17, 24.94]]),
  ...c("europe", "PL", [["Warsaw", 52.23, 21.01]]),
  ...c("europe", "CZ", [["Prague", 50.08, 14.44]]),
  ...c("europe", "HU", [["Budapest", 47.5, 19.04]]),
  ...c("europe", "RO", [["Bucharest", 44.43, 26.1]]),
  ...c("europe", "GR", [["Athens", 37.98, 23.73]]),
  ...c("europe", "TR", [["Istanbul", 41.01, 28.98]]),
  ...c("africa", "NG", [["Lagos", 6.52, 3.38]]),
  ...c("africa", "GH", [["Accra", 5.6, -0.19]]),
  ...c("africa", "KE", [["Nairobi", -1.29, 36.82]]),
  ...c("africa", "ZA", [["Johannesburg", -26.2, 28.05], ["Cape Town", -33.92, 18.42]]),
  ...c("africa", "EG", [["Cairo", 30.04, 31.24]]),
  ...c("africa", "MA", [["Casablanca", 33.57, -7.59]]),
  ...c("africa", "SN", [["Dakar", 14.72, -17.47]]),
  ...c("africa", "ET", [["Addis Ababa", 9.03, 38.74]]),
  ...c("africa", "AO", [["Luanda", -8.84, 13.23]]),
  ...c("middle-east", "AE", [["Dubai", 25.2, 55.27], ["Abu Dhabi", 24.45, 54.38]]),
  ...c("middle-east", "SA", [["Riyadh", 24.71, 46.68]]),
  ...c("middle-east", "QA", [["Doha", 25.29, 51.53]]),
  ...c("middle-east", "IL", [["Tel Aviv", 32.09, 34.78]]),
  ...c("middle-east", "KW", [["Kuwait City", 29.38, 47.99]]),
  ...c("asia", "JP", [["Tokyo", 35.68, 139.65], ["Osaka", 34.69, 135.5]]),
  ...c("asia", "KR", [["Seoul", 37.57, 126.98], ["Busan", 35.18, 129.08]]),
  ...c("asia", "CN", [["Shanghai", 31.23, 121.47], ["Beijing", 39.9, 116.41]]),
  ...c("asia", "HK", [["Hong Kong", 22.32, 114.17]]),
  ...c("asia", "TW", [["Taipei", 25.03, 121.57]]),
  ...c("asia", "TH", [["Bangkok", 13.76, 100.5]]),
  ...c("asia", "SG", [["Singapore", 1.35, 103.82]]),
  ...c("asia", "MY", [["Kuala Lumpur", 3.14, 101.69]]),
  ...c("asia", "ID", [["Jakarta", -6.21, 106.85]]),
  ...c("asia", "PH", [["Manila", 14.6, 120.98]]),
  ...c("asia", "VN", [["Ho Chi Minh City", 10.82, 106.63], ["Hanoi", 21.03, 105.85]]),
  ...c("asia", "IN", [["Mumbai", 19.08, 72.88], ["Delhi", 28.61, 77.21], ["Bangalore", 12.97, 77.59], ["Hyderabad", 17.39, 78.49], ["Chennai", 13.08, 80.27], ["Kolkata", 22.57, 88.36]]),
  ...c("asia", "PK", [["Karachi", 24.86, 67.01]]),
  ...c("oceania", "AU", [["Sydney", -33.87, 151.21], ["Melbourne", -37.81, 144.96], ["Brisbane", -27.47, 153.03], ["Perth", -31.95, 115.86]]),
  ...c("oceania", "NZ", [["Auckland", -36.85, 174.76]]),
];

export const cityId = (city: string) =>
  city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, "-");
