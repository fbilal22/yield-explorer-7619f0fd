export interface Country {
  name: string;
  slug: string;
  region: string;
}

export const countries: Country[] = [
  // Europe
  { name: "Switzerland", slug: "switzerland", region: "Europe" },
  { name: "Germany", slug: "germany", region: "Europe" },
  { name: "Netherlands", slug: "netherlands", region: "Europe" },
  { name: "Denmark", slug: "denmark", region: "Europe" },
  { name: "Sweden", slug: "sweden", region: "Europe" },
  { name: "Ireland", slug: "ireland", region: "Europe" },
  { name: "Austria", slug: "austria", region: "Europe" },
  { name: "Portugal", slug: "portugal", region: "Europe" },
  { name: "Cyprus", slug: "cyprus", region: "Europe" },
  { name: "Finland", slug: "finland", region: "Europe" },
  { name: "Slovenia", slug: "slovenia", region: "Europe" },
  { name: "Croatia", slug: "croatia", region: "Europe" },
  { name: "Spain", slug: "spain", region: "Europe" },
  { name: "Belgium", slug: "belgium", region: "Europe" },
  { name: "Greece", slug: "greece", region: "Europe" },
  { name: "Italy", slug: "italy", region: "Europe" },
  { name: "Slovakia", slug: "slovakia", region: "Europe" },
  { name: "France", slug: "france", region: "Europe" },
  { name: "Malta", slug: "malta", region: "Europe" },
  { name: "Lithuania", slug: "lithuania", region: "Europe" },
  { name: "Bulgaria", slug: "bulgaria", region: "Europe" },
  { name: "Norway", slug: "norway", region: "Europe" },
  { name: "United Kingdom", slug: "united-kingdom", region: "Europe" },
  { name: "Czech Republic", slug: "czech-republic", region: "Europe" },
  { name: "Serbia", slug: "serbia", region: "Europe" },
  { name: "Poland", slug: "poland", region: "Europe" },
  { name: "Iceland", slug: "iceland", region: "Europe" },
  { name: "Romania", slug: "romania", region: "Europe" },
  { name: "Hungary", slug: "hungary", region: "Europe" },
  { name: "Ukraine", slug: "ukraine", region: "Europe" },
  
  // Asia
  { name: "Taiwan", slug: "taiwan", region: "Asia" },
  { name: "Thailand", slug: "thailand", region: "Asia" },
  { name: "China", slug: "china", region: "Asia" },
  { name: "Japan", slug: "japan", region: "Asia" },
  { name: "Singapore", slug: "singapore", region: "Asia" },
  { name: "Hong Kong", slug: "hong-kong", region: "Asia" },
  { name: "South Korea", slug: "south-korea", region: "Asia" },
  { name: "Malaysia", slug: "malaysia", region: "Asia" },
  { name: "Israel", slug: "israel", region: "Asia" },
  { name: "Vietnam", slug: "vietnam", region: "Asia" },
  { name: "Qatar", slug: "qatar", region: "Asia" },
  { name: "Philippines", slug: "philippines", region: "Asia" },
  { name: "Indonesia", slug: "indonesia", region: "Asia" },
  { name: "Bahrain", slug: "bahrain", region: "Asia" },
  { name: "India", slug: "india", region: "Asia" },
  { name: "Jordan", slug: "jordan", region: "Asia" },
  { name: "Bangladesh", slug: "bangladesh", region: "Asia" },
  { name: "Sri Lanka", slug: "sri-lanka", region: "Asia" },
  { name: "Pakistan", slug: "pakistan", region: "Asia" },
  { name: "Kazakhstan", slug: "kazakhstan", region: "Asia" },
  { name: "Turkey", slug: "turkey", region: "Asia" },
  
  // Africa
  { name: "Morocco", slug: "morocco", region: "Africa" },
  { name: "South Africa", slug: "south-africa", region: "Africa" },
  { name: "Namibia", slug: "namibia", region: "Africa" },
  { name: "Botswana", slug: "botswana", region: "Africa" },
  { name: "Kenya", slug: "kenya", region: "Africa" },
  { name: "Nigeria", slug: "nigeria", region: "Africa" },
  { name: "Uganda", slug: "uganda", region: "Africa" },
  { name: "Zambia", slug: "zambia", region: "Africa" },
  { name: "Egypt", slug: "egypt", region: "Africa" },
  { name: "Mauritius", slug: "mauritius", region: "Africa" },
  
  // Americas
  { name: "Canada", slug: "canada", region: "Americas" },
  { name: "United States", slug: "united-states", region: "Americas" },
  { name: "Peru", slug: "peru", region: "Americas" },
  { name: "Chile", slug: "chile", region: "Americas" },
  { name: "Mexico", slug: "mexico", region: "Americas" },
  { name: "Colombia", slug: "colombia", region: "Americas" },
  { name: "Brazil", slug: "brazil", region: "Americas" },
  
  // Oceania
  { name: "New Zealand", slug: "new-zealand", region: "Oceania" },
  { name: "Australia", slug: "australia", region: "Oceania" },
];

export const regions = [...new Set(countries.map(c => c.region))];

export const maturities = [
  "1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"
];
