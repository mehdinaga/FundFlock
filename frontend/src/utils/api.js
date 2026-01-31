import { Platform } from "react-native";

export const API_BASE =
    Platform.OS === "android"
        ? "http://10.0.2.2:5000"
        : "http://localhost:5000";

export async function healthCheck() {
    const res = await fetch(`${API_BASE}/`);
    return res.json();
}
