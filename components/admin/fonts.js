import { Noto_Sans_Thai, Noto_Serif_Thai, Playfair_Display } from "next/font/google";

const display = Playfair_Display({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const serifTh = Noto_Serif_Thai({ subsets: ["thai"], weight: ["500", "600"], variable: "--font-serif-th" });
const body = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

export const adminFonts = `${display.variable} ${serifTh.variable} ${body.variable}`;
