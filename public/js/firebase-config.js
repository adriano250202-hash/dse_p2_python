import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6AXFuzpvcO5xUXIz07tZ-ftCPH9lu0PM",
  authDomain: "dse-p2-f3944.firebaseapp.com",
  databaseURL: "https://dse-p2-f3944-default-rtdb.firebaseio.com",
  projectId: "dse-p2-f3944",
  storageBucket: "dse-p2-f3944.firebasestorage.app",
  messagingSenderId: "121446685623",
  appId: "1:121446685623:web:42c99842f291b8c5f86632"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);