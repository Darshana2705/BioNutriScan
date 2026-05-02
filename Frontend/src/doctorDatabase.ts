// Real doctor database from Practo - Mumbai (with actual Practo profile images)

export interface Doctor {
  name: string;
  specialty: string;
  experience: string;
  rating: number;
  address: string;
  availability: string;
  fee: string;
  practoLink: string;
  image: string;
}

export interface DoctorDatabase {
  dermatologist: Doctor[];
  nutritionist: Doctor[];
  physician: Doctor[];
}

export const doctorDatabase: DoctorDatabase = {
  dermatologist: [
    { name: "Dr. Kshama P Vibhakar", specialty: "Dermatologist & Cosmetologist", experience: "23 years", rating: 4.7, address: "Skin 'N' Sculpt, Andheri East, Mumbai", availability: "Mon-Sat", fee: "₹1500", practoLink: "https://www.practo.com/mumbai/doctor/kshama-vibhakar-dermatologist-cosmetologist", image: "/doctors/kshama-vibhakar.jpg" },
    { name: "Dr. Vaidehi Newaskar", specialty: "Dermatologist", experience: "16 years", rating: 4.9, address: "Krasa Skin and Hair Clinic, Bandra West, Mumbai", availability: "Mon-Sat", fee: "₹1500", practoLink: "https://www.practo.com/mumbai/doctor/dr-vaidehi-newaskar-dermatologist", image: "/doctors/vaidehi-newaskar.jpg" },
    { name: "Dr. Suraj Shetty", specialty: "Dermatologist", experience: "17 years", rating: 4.9, address: "Tvaksh Advanced Skin And Hair Clinic, Andheri West, Mumbai", availability: "Mon-Sat", fee: "₹1500", practoLink: "https://www.practo.com/mumbai/doctor/suraj-shetty-dermatologist", image: "/doctors/suraj-shetty.png" },
    { name: "Dr. Amit Gulati", specialty: "Dermatologist", experience: "19 years", rating: 4.9, address: "Akira Skin And Hair Clinic, Malad West, Mumbai", availability: "Mon-Sat", fee: "₹1200", practoLink: "https://www.practo.com/mumbai/doctor/amit-gulati-1-dermatologist", image: "/doctors/amit-gulati.jpg" },
  ],
  nutritionist: [
    { name: "Dr. Zubeda Tumbi", specialty: "Clinical Nutritionist (PhD)", experience: "37 years", rating: 4.8, address: "Healthwatch Nutrition Clinic, Andheri West, Mumbai", availability: "Mon-Sat", fee: "₹1500", practoLink: "https://www.practo.com/mumbai/therapist/dr-zubeda-tumbi-dietitian-nutritionist-dietitian-nutritionist", image: "/doctors/zubeda-tumbi.jpg" },
    { name: "Ms. Geetanjali", specialty: "Dietitian/Nutritionist", experience: "22 years", rating: 4.9, address: "Medical Nutrition Clinic, Khar West, Mumbai", availability: "Mon-Sat", fee: "₹2000", practoLink: "https://www.practo.com/mumbai/therapist/amit-86-dietitian-nutritionist", image: "/doctors/geetanjali.jpg" },
    { name: "Ms. Smita Nanda R D", specialty: "Registered Dietitian", experience: "20 years", rating: 4.9, address: "RD Smita Nanda Nutrition Consultant, Kandivali East, Mumbai", availability: "Mon-Sat", fee: "₹1400", practoLink: "https://www.practo.com/mumbai/therapist/smita-nanda-dietitian-nutritionist-dietitian-nutritionist", image: "/doctors/smita-nanda.jpg" },
    { name: "Ms. Kamna Bhandari", specialty: "Dietitian/Nutritionist", experience: "28 years", rating: 4.9, address: "Eat Right With Kamna Bhandari, Khar West, Mumbai", availability: "Mon-Sat", fee: "₹2700", practoLink: "https://www.practo.com/mumbai/therapist/kamna-bhandari-dietitian-nutritionist", image: "/doctors/kamna-bhandari.jpg" },
  ],
  physician: [
    { name: "Dr. Ashish Sarwate", specialty: "General Physician (Diabetology)", experience: "29 years", rating: 4.9, address: "Aditi Hospital, Mulund West, Mumbai", availability: "Mon-Sat", fee: "₹1000", practoLink: "https://www.practo.com/mumbai/doctor/dr-ashish-sarwate-diabetologist", image: "/doctors/ashish-sarwate.jpg" },
    { name: "Dr. Dnyaneshwar Shinde", specialty: "General Physician", experience: "25 years", rating: 5.0, address: "USSH Hospital, Mulund West, Mumbai", availability: "Mon-Sat", fee: "₹1500", practoLink: "https://www.practo.com/mumbai/doctor/dr-dnyaneshwar-shinde-alternative-medicine", image: "/doctors/dnyaneshwar-shinde.jpg" },
    { name: "Dr. Shah Arpan Rameshchandra", specialty: "General Physician", experience: "20 years", rating: 4.9, address: "SRV-C Hospital, Chembur, Mumbai", availability: "Mon-Sat", fee: "₹1500", practoLink: "https://www.practo.com/mumbai/doctor/dr-shah-arpan-rameshchandra-general-physician", image: "" },
    { name: "Dr. Anup Taksande", specialty: "General Physician & Cardiologist", experience: "23 years", rating: 4.4, address: "Wockhardt Hospital, Mira Road, Mumbai", availability: "Mon-Sat", fee: "₹1200", practoLink: "https://www.practo.com/mumbai/doctor/anup-taksande-cardiologist-general-physician", image: "/doctors/anup-taksande.png" },
  ]
};

// Doctor type icons (fallback when image not available)
export const doctorTypeIcons: Record<string, string> = {
  dermatologist: "👨‍⚕️",
  nutritionist: "🥗",
  physician: "🩺"
};
