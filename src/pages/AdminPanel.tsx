import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Crown, MapPin, CalendarCheck, Trash2, MessageCircle, FileText, Plus, ArrowLeft, X, Car, CheckCircle, Clock,
  Bell, AlertTriangle, Shield, ChevronDown, ChevronUp, Users, TrendingUp, Timer, Settings,
  ImageIcon, DollarSign, BarChart3, Loader2, Wifi, LogIn, Eye, EyeOff, Building2, Phone, Mail,
  ChevronRight, CalendarClock, Share2, Hash, Pencil, UserRound, Menu
} from "lucide-react";
import { jsPDF } from "jspdf";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile, type User as FBUser,
  reauthenticateWithCredential, EmailAuthProvider,
  updatePassword, verifyBeforeUpdateEmail
} from "firebase/auth";
import { auth, ADMIN_EMAILS } from "@/lib/firebase";
import carLiftLogo from "@/assets/carlift-logo-new.png";
import {
  getBookings, saveBookings, getPickupLocations, getDropoffMapping,
  savePickupLocations, saveDropoffMapping, CARS_LIST, ROUTES_DATA, type Booking, type RouteData, type PaymentInfo,
  getDaysUntilDeadline, getCarImages, saveCarImages, parseFareAmount,
  getFarePerKmLocal, saveFarePerKmLocal,
  getWorkingDaysLocal, saveWorkingDaysLocal,
  type CompanyInfo, getCompanyInfoLocal, saveCompanyInfoLocal,
  type DriverInfo
} from "@/lib/store";
import {
  subscribeToBookings, updateBookingInFirestore, deleteBookingFromFirestore,
  getCarImagesFromFirestore, saveCarImagesToFirestore, uploadCarImageToStorage, deleteCarImageFromStorage,
  saveRoutesToFirestore, subscribeToRoutes, savePaymentInfoToFirestore, subscribeToPaymentInfo,
  saveFarePerKmToFirestore, subscribeToFarePerKm,
  saveWorkingDaysToFirestore, subscribeToWorkingDays,
  subscribeToNotifications, markNotificationReadInFirestore,
  saveLocationsToFirestore, subscribeToLocations,
  saveCarsListToFirestore, subscribeToCarsListFromFirestore,
  saveCompanyInfoToFirestore, subscribeToCompanyInfo,
  isAdminInFirestore, saveUserToFirestore,
  uploadDriverImageToStorage, deleteDriverImageFromStorage,
  saveDriversListToFirestore, subscribeToDriversList,
  saveDriverImagesToFirestore, getDriverImagesFromFirestore
} from "@/lib/firestoreStore";

// Format date/time in Pakistan Standard Time (Karachi, UTC+5)
function formatPKT(isoString: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

type AdminTab = 'bookings' | 'routes' | 'settings';
type NotifDoc = import('@/lib/store').Notification & { _docId?: string };

// ── Popup Modal ──────────────────────────────────────────────────────────────
const PopupModal = ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-background/90 z-[2000] flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-card border-2 border-primary rounded-2xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-primary pb-3 mb-4">
          <h3 className="text-primary font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-primary hover:text-primary/70 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const PopupOption = ({ label, active, onClick, icon, onImageClick }: { label: string; active?: boolean; onClick: () => void; icon?: React.ReactNode; onImageClick?: (e: React.MouseEvent) => void }) => (
  <div className={`flex items-center gap-3 w-full my-1.5 border rounded-lg transition-all hover:scale-[1.01] ${active ? 'bg-primary/30 border-primary shadow-[0_0_10px_hsla(0,70%,45%,0.3)]' : 'bg-primary/10 border-border hover:bg-primary/20 hover:border-primary'}`}>
    {icon && (
      <button
        onClick={onImageClick || (() => {})}
        className={`flex-shrink-0 pl-3 py-3 ${onImageClick ? 'cursor-zoom-in' : 'cursor-default'}`}
        title={onImageClick ? "View full image" : undefined}
      >
        {icon}
      </button>
    )}
    <button onClick={onClick} className="flex-1 p-3 text-left text-sm font-medium flex items-center gap-2">
      <span className="flex-1">{label}</span>
      {active && <CheckCircle className="w-4 h-4 text-primary" />}
    </button>
  </div>
);

const ConfirmDeleteModal = ({ open, onClose, onConfirm, itemName }: { open: boolean; onClose: () => void; onConfirm: () => void; itemName: string }) => (
  <PopupModal open={open} onClose={onClose} title="Confirm Delete">
    <div className="text-center py-4">
      <Shield className="w-12 h-12 text-destructive mx-auto mb-3" />
      <p className="text-foreground mb-2 font-semibold">Are you sure you want to delete?</p>
      <p className="text-muted-foreground text-sm mb-6">"{itemName}" will be permanently removed.</p>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 bg-muted border border-border rounded-lg font-semibold text-sm hover:bg-muted/80 transition-colors">Cancel</button>
        <button onClick={onConfirm} className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg font-semibold text-sm hover:bg-destructive/80 transition-colors">Delete</button>
      </div>
    </div>
  </PopupModal>
);

// ── Full Image Popup ─────────────────────────────────────────────────────────
const FullImagePopup = ({ url, carName, onClose }: { url: string; carName: string; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/95 z-[9000] flex flex-col items-center justify-center p-4" onClick={onClose}>
    <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-3">
        <p className="text-white font-semibold text-sm truncate flex-1 mr-3">{carName}</p>
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors flex-shrink-0">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
      <img
        src={url}
        alt={carName}
        className="w-full max-h-[75vh] object-contain rounded-xl border border-white/20"
        onError={e => { (e.target as HTMLImageElement).alt = 'Image not available'; }}
      />
      <p className="text-center text-white/50 text-xs mt-3">Tap outside to close</p>
    </div>
  </div>
);

// ── Format Pakistani WhatsApp number ──────────────────────────────────────────
function formatWANumber(num: string): string {
  const clean = num.replace(/\D/g, '');
  if (clean.startsWith('0') && clean.length === 11) return '92' + clean.slice(1);
  if (clean.startsWith('92')) return clean;
  return clean;
}

// ── PDF Logo Loader ──────────────────────────────────────────────────────────
function loadLogoBase64(): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 300;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = carLiftLogo;
  });
}

// ── Load remote image as base64 (for embedding in PDF) ────────────────────────
async function loadImageBase64FromUrl(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  });
}

// ── Invoice PDF Builder (returns jsPDF doc) ───────────────────────────────────
async function buildInvoicePDF(
  b: Booking,
  carImages: Record<string, string>,
  companyInfo: CompanyInfo,
  invoiceNum?: string,
  driversList?: DriverInfo[],
  driverImages?: Record<string, string>
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const logoBase64 = await loadLogoBase64();

  // Raw URLs only — images are clickable links in the PDF, never embedded
  const rawCarImg = b.assignedCar ? carImages[b.assignedCar] : '';
  const assignedDriver = driversList?.find(d => d.id === b.assignedDriver);
  const rawDriverImg = assignedDriver && driverImages ? driverImages[assignedDriver.id] : '';

  // Booking date formatted in PKT
  const bookingDatePKT = b.createdAt
    ? new Date(b.createdAt).toLocaleString('en-PK', {
        timeZone: 'Asia/Karachi',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

  const invNum = invoiceNum || `INV-${b.id}`;

  // ── Outer page border ─────────────────────────────────────────────────────
  doc.setDrawColor(200, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(4, 4, pageW - 8, pageH - 8);

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, pageW, 50, 'F');
  doc.setFillColor(200, 0, 0);
  doc.rect(0, 50, pageW, 3, 'F');

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', 12, 6, 40, 35); } catch { /* skip */ }
  }

  // Company info (left side)
  doc.setTextColor(210, 210, 210);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(companyInfo.name || 'Car Lift', 58, 14);
  doc.setTextColor(200, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(companyInfo.tagline || 'Premium Monthly Car Service', 58, 20);
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.text(`Call: ${companyInfo.phone}`, 58, 28);
  doc.text(`Email: ${companyInfo.email}`, 58, 34);
  doc.setTextColor(130, 130, 130);
  doc.setFontSize(7.5);
  doc.text(companyInfo.address, 58, 41);
  if (companyInfo.address2) doc.text(companyInfo.address2, 58, 46);

  // INVOICE title (right side)
  doc.setTextColor(200, 0, 0);
  doc.setFontSize(30);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageW - 14, 22, { align: "right" });
  // Invoice number box
  doc.setFillColor(28, 8, 8);
  doc.roundedRect(pageW - 64, 26, 50, 18, 2, 2, 'F');
  doc.setDrawColor(200, 0, 0);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageW - 64, 26, 50, 18, 2, 2, 'S');
  doc.setTextColor(155, 155, 155);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("INVOICE NO.", pageW - 39, 31.5, { align: "center" });
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`${invNum}`, pageW - 39, 39, { align: "center" });

  // Date
  doc.setTextColor(155, 155, 155);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }), pageW - 14, 50, { align: "right" });

  // ── Billed To ─────────────────────────────────────────────────────────────
  const billY = 60;
  const billBoxW = (pageW - 28) * 0.58;
  doc.setFillColor(14, 14, 14);
  doc.roundedRect(14, billY, billBoxW, 38, 3, 3, 'F');
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, billY, billBoxW, 38, 3, 3, 'S');
  doc.setFillColor(200, 0, 0);
  doc.rect(14, billY, 4, 38, 'F');
  doc.setTextColor(200, 0, 0);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("BILLED TO", 23, billY + 9);
  doc.setTextColor(245, 245, 245);
  doc.setFontSize(14);
  doc.text(b.name, 23, billY + 20);
  doc.setTextColor(155, 155, 155);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`WhatsApp: ${b.whatsapp}`, 23, billY + 29);
  doc.text(`Start Date: ${b.startDate}`, 23, billY + 36);

  // Status badge (right of billed-to)
  const isApproved = b.status === 'approved';
  const badgeX = 14 + billBoxW + 6;
  const badgeW = pageW - 14 - badgeX;
  doc.setFillColor(isApproved ? 0 : 100, isApproved ? 100 : 40, 0);
  doc.roundedRect(badgeX, billY, badgeW, 38, 3, 3, 'F');
  doc.setDrawColor(isApproved ? 40 : 200, isApproved ? 160 : 80, isApproved ? 40 : 0);
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, billY, badgeW, 38, 3, 3, 'S');
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("STATUS", badgeX + badgeW / 2, billY + 12, { align: "center" });
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(isApproved ? 'APPROVED' : 'PENDING', badgeX + badgeW / 2, billY + 24, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(isApproved ? 150 : 220, isApproved ? 230 : 180, isApproved ? 150 : 100);
  doc.text(isApproved ? '[ Confirmed ]' : '[ Awaiting Approval ]', badgeX + badgeW / 2, billY + 33, { align: "center" });

  // ── Table ─────────────────────────────────────────────────────────────────
  const ROW_H = 13;
  const tableY = billY + 46;
  doc.setFillColor(200, 0, 0);
  doc.rect(14, tableY, pageW - 28, 12, 'F');
  // Subtle shine effect on header
  doc.setFillColor(220, 20, 20);
  doc.rect(14, tableY, pageW - 28, 5, 'F');
  doc.setFillColor(200, 0, 0);
  doc.rect(14, tableY + 5, pageW - 28, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", 20, tableY + 8.5);
  doc.text("DETAILS", pageW - 20, tableY + 8.5, { align: "right" });

  const rows: [string, string][] = [
    ["Booking Date & Time", bookingDatePKT],
    ["Pickup Location", b.pickup],
    ["Drop-off Location", b.dropoff],
    ["Timing Slot", b.timing],
    ["Vehicle Class", b.class],
    ["Assigned Vehicle", b.assignedCar || "To Be Assigned"],
    ["Payment Method", b.payment],
  ];

  let ry = tableY + 12;
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? 22 : 14;
    doc.setFillColor(bg, bg, bg);
    doc.rect(14, ry, pageW - 28, ROW_H, 'F');
    // Left accent stripe on odd rows
    if (i % 2 === 0) {
      doc.setFillColor(200, 0, 0);
      doc.rect(14, ry, 2.5, ROW_H, 'F');
    }
    doc.setTextColor(190, 190, 190);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(row[0], 21, ry + ROW_H * 0.65);
    doc.setTextColor(235, 235, 235);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const val = row[1] || '—';
    doc.text(val, pageW - 20, ry + ROW_H * 0.65, { align: "right" });
    ry += ROW_H;
  });

  // ── Car image row (link only — no embedded image) ─────────────────────────
  if (b.assignedCar) {
    const CAR_ROW_H = 18;
    const rowBgCar = rows.length % 2 === 0 ? 22 : 14;
    doc.setFillColor(rowBgCar, rowBgCar, rowBgCar);
    doc.rect(14, ry, pageW - 28, CAR_ROW_H, 'F');
    doc.setFillColor(200, 0, 0);
    doc.rect(14, ry, 2.5, CAR_ROW_H, 'F');

    // Left label
    doc.setTextColor(155, 155, 155);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ASSIGNED VEHICLE", 21, ry + 11.5);

    // Right: clickable link or "No photo"
    if (rawCarImg?.startsWith('http')) {
      doc.setTextColor(100, 170, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.textWithLink("Click to view car photo", pageW - 20, ry + 11.5, { url: rawCarImg, align: "right" });
    } else {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "italic");
      doc.text("No photo uploaded", pageW - 20, ry + 11.5, { align: "right" });
    }

    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.2);
    doc.line(14, ry + CAR_ROW_H, 14 + (pageW - 28), ry + CAR_ROW_H);
    ry += CAR_ROW_H;
  }

  // ── Driver Info row (link only — no embedded image) ───────────────────────
  if (assignedDriver) {
    const DRIVER_ROW_H = 36;
    const driverRowBg = (rows.length + (b.assignedCar ? 1 : 0)) % 2 === 0 ? 22 : 14;
    doc.setFillColor(driverRowBg, driverRowBg, driverRowBg);
    doc.rect(14, ry, pageW - 28, DRIVER_ROW_H, 'F');
    doc.setFillColor(200, 0, 0);
    doc.rect(14, ry, 2.5, DRIVER_ROW_H, 'F');

    // Left: label + name + phone
    doc.setTextColor(155, 155, 155);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("ASSIGNED DRIVER", 21, ry + 9);
    doc.setTextColor(235, 235, 235);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(assignedDriver.name, 21, ry + 20);
    if (assignedDriver.phone) {
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(`Ph: ${assignedDriver.phone}`, 21, ry + 29);
    }

    // Right: clickable driver photo link
    if (rawDriverImg?.startsWith('http')) {
      doc.setTextColor(100, 170, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.textWithLink("Click to view driver photo", pageW - 20, ry + 20, { url: rawDriverImg, align: "right" });
    } else {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text("No photo uploaded", pageW - 20, ry + 20, { align: "right" });
    }

    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.2);
    doc.line(14, ry + DRIVER_ROW_H, 14 + (pageW - 28), ry + DRIVER_ROW_H);
    ry += DRIVER_ROW_H;
  }

  // ── Fare box (full-width) ─────────────────────────────────────────────────
  ry += 8;

  // Parse fare: "Rs 28,942 / month (22 working days + 11% SRB tax)"
  //  → mainFare = "Rs 28,942 / month"
  //  → fareDetail = "22 working days + 11% SRB tax"
  const fareRaw = b.fare || '';
  const parenIdx = fareRaw.indexOf('(');
  const mainFare = parenIdx > 0 ? fareRaw.substring(0, parenIdx).trim() : fareRaw.trim();
  const fareDetail = parenIdx > 0 ? fareRaw.substring(parenIdx + 1).replace(/\)$/, '').trim() : '';

  const FARE_BOX_H = fareDetail ? 40 : 32;
  // Shadow layer
  doc.setFillColor(100, 0, 0);
  doc.roundedRect(16, ry + 2, pageW - 28, FARE_BOX_H, 3, 3, 'F');
  // Main fare box
  doc.setFillColor(160, 0, 0);
  doc.roundedRect(14, ry, pageW - 28, FARE_BOX_H, 3, 3, 'F');
  doc.setFillColor(200, 0, 0);
  doc.roundedRect(14, ry, pageW - 28, 15, 3, 3, 'F');
  doc.setFillColor(160, 0, 0);
  doc.rect(14, ry + 12, pageW - 28, 3, 'F');

  doc.setTextColor(255, 210, 210);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL MONTHLY FARE", 22, ry + 10);
  const statusLabel = b.status === 'approved' ? '[ CONFIRMED ]' : '[ PENDING APPROVAL ]';
  doc.setTextColor(255, 240, 210);
  doc.setFontSize(7.5);
  doc.text(statusLabel, pageW - 20, ry + 10, { align: "right" });

  // Main amount — large white text
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(mainFare, pageW / 2, ry + 25, { align: "center" });

  // Breakdown line — smaller, light red
  if (fareDetail) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 190, 190);
    doc.text(fareDetail, pageW / 2, ry + 33, { align: "center" });
  }

  // ── Payment notice strip ──────────────────────────────────────────────────
  ry += FARE_BOX_H + 8;
  doc.setFillColor(10, 10, 10);
  doc.roundedRect(14, ry, pageW - 28, 22, 2, 2, 'F');
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, ry, pageW - 28, 22, 2, 2, 'S');
  doc.setFillColor(200, 0, 0);
  doc.rect(14, ry, 4, 22, 'F');

  doc.setTextColor(200, 80, 80);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for choosing " + (companyInfo.name || 'Car Lift') + "!", 23, ry + 9);
  doc.setTextColor(110, 110, 110);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.text("System-generated invoice. Send payment via the selected method before start date.", 23, ry + 17);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = pageH - 30;
  doc.setFillColor(6, 6, 6);
  doc.rect(0, footerY, pageW, 30, 'F');
  doc.setFillColor(200, 0, 0);
  doc.rect(0, footerY, pageW, 3, 'F');

  // Footer center divider line
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  doc.line(14, footerY + 18, pageW - 14, footerY + 18);

  doc.setTextColor(150, 0, 0);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(companyInfo.name.toUpperCase() + " — CONTACT", pageW / 2, footerY + 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.setFontSize(7.5);
  doc.text(`Call: ${companyInfo.phone}  |  Email: ${companyInfo.email}`, pageW / 2, footerY + 22, { align: "center" });
  doc.setFontSize(6.5);
  doc.setTextColor(80, 80, 80);
  doc.text(companyInfo.address + (companyInfo.address2 ? '  |  ' + companyInfo.address2 : ''), pageW / 2, footerY + 28, { align: "center" });

  return doc;
}

// ── Download Invoice PDF ──────────────────────────────────────────────────────
function getInvoiceFileName(b: Booking) {
  const safeName = b.name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_').replace(/_+/g, '_').trim();
  return `CarLift_Invoice_${safeName}_${b.id}.pdf`;
}

async function generateInvoicePDF(
  b: Booking,
  carImages: Record<string, string>,
  companyInfo: CompanyInfo,
  invoiceNum?: string,
  driversList?: DriverInfo[],
  driverImages?: Record<string, string>
) {
  const freshCarImages = await getCarImagesFromFirestore().catch(() => ({}));
  const mergedCarImages = { ...carImages, ...freshCarImages };
  const freshDriverImages = await getDriverImagesFromFirestore().catch(() => ({}));
  const mergedDriverImages = { ...(driverImages || {}), ...freshDriverImages };
  const doc = await buildInvoicePDF(b, mergedCarImages, companyInfo, invoiceNum, driversList, mergedDriverImages);
  doc.save(getInvoiceFileName(b));
}

// ── Share Invoice PDF via WhatsApp ────────────────────────────────────────────
async function shareInvoicePDFWhatsApp(
  b: Booking,
  carImages: Record<string, string>,
  companyInfo: CompanyInfo,
  invoiceNum?: string,
  driversList?: DriverInfo[],
  driverImages?: Record<string, string>,
  onDesktopFallback?: (fileName: string, waUrl: string) => void
) {
  const freshCarImages = await getCarImagesFromFirestore().catch(() => ({}));
  const mergedCarImages = { ...carImages, ...freshCarImages };
  const freshDriverImages = await getDriverImagesFromFirestore().catch(() => ({}));
  const mergedDriverImages = { ...(driverImages || {}), ...freshDriverImages };
  const doc = await buildInvoicePDF(b, mergedCarImages, companyInfo, invoiceNum, driversList, mergedDriverImages);
  const fileName = getInvoiceFileName(b);

  const waNum = formatWANumber(b.whatsapp);
  const rentalNum = companyInfo.phone ? `\nFor queries: ${companyInfo.phone}` : '';
  const waMsg = encodeURIComponent(
    `Dear ${b.name},\n\nPlease find your Car Lift invoice details below.\n\nBooking #${b.id}\nRoute: ${b.pickup} → ${b.dropoff}\nFare: ${b.fare}\nStatus: ${b.status.toUpperCase()}\nStart Date: ${b.startDate}${rentalNum}\n\nThank you for choosing ${companyInfo.name || 'Car Lift'}!`
  );
  const waUrl = `https://wa.me/${waNum}?text=${waMsg}`;

  // Try native Web Share API (works on Android/iOS PWA)
  try {
    const blob = doc.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Invoice - ${b.name}`, text: `Car Lift invoice for ${b.name}` });
      return;
    }
  } catch {
    // Fall through to desktop fallback
  }

  // Desktop fallback: download PDF + notify with modal
  doc.save(fileName);
  onDesktopFallback?.(fileName, waUrl);
}

// ── Deadline Badge ────────────────────────────────────────────────────────────
const DeadlineBadge = ({ startDate }: { startDate: string }) => {
  const days = getDaysUntilDeadline(startDate);
  if (days === null) return <span className="text-xs text-muted-foreground">{startDate}</span>;
  if (days < 0) return (
    <span className="inline-flex items-center gap-1 text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">
      <Timer className="w-3 h-3" /> Started
    </span>
  );
  if (days <= 3) return (
    <span className="inline-flex items-center gap-1 text-xs bg-destructive/20 text-destructive border border-destructive/40 px-2 py-0.5 rounded-full animate-pulse">
      <AlertTriangle className="w-3 h-3" /> {days}d left
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-full">
      <Timer className="w-3 h-3" /> {days}d left
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-muted-foreground px-2 py-0.5 rounded-full">
      <Timer className="w-3 h-3" /> {days}d left
    </span>
  );
};

// ── Admin Login Screen ────────────────────────────────────────────────────────
const AdminLoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);

      // If email is in the whitelist, ensure the Firestore role is set to admin
      const isWhitelisted = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(trimmedEmail);
      if (isWhitelisted) {
        await saveUserToFirestore(cred.user.uid, {
          name: cred.user.displayName || trimmedEmail.split('@')[0],
          email: trimmedEmail,
          phone: '',
          role: 'admin',
        });
        // Request notification permission (needed for PWA badge on some platforms)
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
        onLogin();
        setLoading(false);
        return;
      }

      // Not in whitelist — deny access regardless of Firestore role
      await signOut(auth);
      setError('Access denied. Only authorised admin accounts can access this panel.');
      setLoading(false);
      return;
    } catch {
      setError('Invalid email or password.');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!regName || !regEmail || !regPassword) { setError('All fields are required.'); return; }
    if (regPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail.trim(), regPassword);
      await updateProfile(cred.user, { displayName: regName });
      await saveUserToFirestore(cred.user.uid, {
        name: regName, email: regEmail.trim(), phone: '', role: 'admin',
      });
      setSuccess('Admin account created successfully! You are now logged in.');
      setTimeout(() => onLogin(), 1000);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      const map: Record<string, string> = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
      };
      setError(map[code] || 'Registration failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border-2 border-primary rounded-2xl p-8 shadow-2xl shadow-primary/20">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 border-2 border-primary/50 rounded-2xl mb-4">
              <Crown className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-black text-primary uppercase tracking-wider">Admin Panel</h1>
            <p className="text-muted-foreground text-sm mt-1">Car Lift operations management</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-input/60 rounded-xl p-1 mb-6">
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${tab === t ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
                {t === 'login' ? 'Sign In' : 'Register Admin'}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-destructive/15 border border-destructive/40 text-destructive text-sm px-4 py-3 rounded-xl flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/15 border border-green-500/40 text-green-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-primary uppercase tracking-wider">Admin Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com"
                  required autoComplete="email"
                  className="px-4 py-3 bg-input border border-primary/40 rounded-xl text-foreground focus:border-primary focus:outline-none transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-primary uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="current-password"
                    className="w-full px-4 py-3 bg-input border border-primary/40 rounded-xl text-foreground focus:border-primary focus:outline-none transition-colors pr-12" />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="bg-primary hover:bg-primary/85 text-primary-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-60 mt-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-1">
                <p className="text-xs text-muted-foreground">Create a new admin account with full access to the admin panel.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-primary uppercase tracking-wider">Full Name</label>
                <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Admin Name"
                  required className="px-4 py-3 bg-input border border-primary/40 rounded-xl text-foreground focus:border-primary focus:outline-none transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-primary uppercase tracking-wider">Email Address</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="admin@example.com"
                  required autoComplete="email"
                  className="px-4 py-3 bg-input border border-primary/40 rounded-xl text-foreground focus:border-primary focus:outline-none transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-primary uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input type={showRegPw ? "text" : "password"} value={regPassword} onChange={e => setRegPassword(e.target.value)}
                    placeholder="Min. 6 characters" required autoComplete="new-password"
                    className="w-full px-4 py-3 bg-input border border-primary/40 rounded-xl text-foreground focus:border-primary focus:outline-none transition-colors pr-12" />
                  <button type="button" onClick={() => setShowRegPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showRegPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="bg-primary hover:bg-primary/85 text-primary-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-60 mt-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
                {loading ? 'Creating account...' : 'Create Admin Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main AdminPanel ──────────────────────────────────────────────────────────
const AdminPanel = () => {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState<FBUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('bookings');
  const [bookings, setBookings] = useState<Booking[]>(getBookings());
  const [pickups, setPickups] = useState(getPickupLocations());
  const [dropMap, setDropMap] = useState(getDropoffMapping());
  const [newPickup, setNewPickup] = useState('');
  const [selectedPickupForDrop, setSelectedPickupForDrop] = useState('');
  const [newDropoff, setNewDropoff] = useState('');
  const [isRealtime, setIsRealtime] = useState(false);

  const [carPopup, setCarPopup] = useState<number | null>(null);
  const [statusPopup, setStatusPopup] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'pickup' | 'dropoff' | 'car'; name: string; parent?: string } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotifDoc[]>([]);
  const [showNewBookingPopup, setShowNewBookingPopup] = useState(false);
  const [newBookingsForPopup, setNewBookingsForPopup] = useState<Booking[]>([]);
  const [routeExpanded, setRouteExpanded] = useState(true);
  const [approveError, setApproveError] = useState<number | null>(null);

  // Car images state
  const [carImages, setCarImages] = useState<Record<string, string>>(getCarImages());
  const [uploadingCar, setUploadingCar] = useState<string | null>(null);
  const [viewCarImage, setViewCarImage] = useState<{ car: string; url: string } | null>(null);

  // Cars list (dynamic from Firestore)
  const [carsList, setCarsList] = useState<string[]>(CARS_LIST);
  const [newCarName, setNewCarName] = useState('');
  const [addingCar, setAddingCar] = useState(false);

  // WhatsApp desktop-share modal state
  const [whatsappShareModal, setWhatsappShareModal] = useState<{ fileName: string; waUrl: string } | null>(null);

  // Settings accordion state
  const [openSettingCard, setOpenSettingCard] = useState<string | null>(null);
  const toggleSettingCard = (id: string) => setOpenSettingCard(prev => prev === id ? null : id);

  // Account security state
  const [securityCurrentPw, setSecurityCurrentPw] = useState('');
  const [securityNewPw, setSecurityNewPw] = useState('');
  const [securityConfirmPw, setSecurityConfirmPw] = useState('');
  const [securityNewEmail, setSecurityNewEmail] = useState('');
  const [securityShowPw, setSecurityShowPw] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  // Drivers state
  const [driversList, setDriversList] = useState<DriverInfo[]>([]);
  const [driverImages, setDriverImages] = useState<Record<string, string>>({});
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [addingDriver, setAddingDriver] = useState(false);
  const [uploadingDriver, setUploadingDriver] = useState<string | null>(null);
  const [viewDriverImage, setViewDriverImage] = useState<{ driverName: string; url: string } | null>(null);
  const [driverPopup, setDriverPopup] = useState<number | null>(null);

  // Routes management state
  const [routes, setRoutes] = useState<RouteData[]>(ROUTES_DATA);
  const [newRouteTitle, setNewRouteTitle] = useState('');
  const [newRouteTiming, setNewRouteTiming] = useState('');
  const [editingRoute, setEditingRoute] = useState<RouteData | null>(null);
  const [savingRoutes, setSavingRoutes] = useState(false);

  // Custom invoice numbers (editable by admin)
  const [customInvoiceNums, setCustomInvoiceNums] = useState<Record<number, string>>({});
  const [editingInvoiceNum, setEditingInvoiceNum] = useState<number | null>(null);

  // Add New Routes popup state
  const [showAddRoutePopup, setShowAddRoutePopup] = useState(false);
  const [newRoutePickupInput, setNewRoutePickupInput] = useState('');
  const [newRouteDropoffInput, setNewRouteDropoffInput] = useState('');
  const [newRouteDropoffList, setNewRouteDropoffList] = useState<string[]>([]);
  const [savingNewRoute, setSavingNewRoute] = useState(false);
  const [deletingAllLocations, setDeletingAllLocations] = useState(false);

  // Payment info state
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    easypaisa: { accName: '', accNumber: '' },
    jazzcash: { accName: '', accNumber: '' },
    bankTransfer: { accName: '', accNumber: '' },
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [farePerKm, setFarePerKm] = useState<number>(getFarePerKmLocal());
  const [fareRateInput, setFareRateInput] = useState<string>(String(getFarePerKmLocal()));
  const [savingFareRate, setSavingFareRate] = useState(false);
  const [workingDays, setWorkingDays] = useState<number>(getWorkingDaysLocal());
  const [workingDaysInput, setWorkingDaysInput] = useState<string>(String(getWorkingDaysLocal()));
  const [savingWorkingDays, setSavingWorkingDays] = useState(false);

  // Company info state
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(getCompanyInfoLocal());
  const [companyInfoInput, setCompanyInfoInput] = useState<CompanyInfo>(getCompanyInfoLocal());
  const [savingCompanyInfo, setSavingCompanyInfo] = useState(false);

  // Force re-check key — used after registration when Firestore write completes
  const [forceRecheckKey, setForceRecheckKey] = useState(0);

  // Auth state listener — role-based check via Firestore + email whitelist
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const emailLower = (user.email || '').toLowerCase();
        const isWhitelisted = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(emailLower);
        const isAdmin = isWhitelisted; // strictly whitelist only
        if (isAdmin) {
          setAdminUser(user);
        } else {
          setAdminUser(null);
        }
      } else {
        setAdminUser(null);
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // Manual re-check triggered after successful admin registration (race condition fix)
  useEffect(() => {
    if (forceRecheckKey === 0) return;
    const user = auth.currentUser;
    if (!user) { setAuthChecked(true); return; }
    const emailLower = (user.email || '').toLowerCase();
    const isWhitelisted = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(emailLower);
    if (isWhitelisted) { setAdminUser(user); }
    else { setAdminUser(null); }
    setAuthChecked(true);
  }, [forceRecheckKey]);

  // Admin PWA manifest
  useEffect(() => {
    const manifest = document.getElementById('pwa-manifest') as HTMLLinkElement | null;
    const prevManifest = manifest?.href || '';
    if (manifest) manifest.href = '/manifest-admin.json';
    // Remove existing apple-touch-icon links and inject admin-specific ones
    document.querySelectorAll<HTMLLinkElement>("link[rel='apple-touch-icon']").forEach(el => el.remove());
    const adminIcon192 = document.createElement('link');
    adminIcon192.rel = 'apple-touch-icon';
    adminIcon192.setAttribute('sizes', '192x192');
    adminIcon192.href = '/icon-admin-192.png?v=4';
    document.head.appendChild(adminIcon192);
    const adminIcon512 = document.createElement('link');
    adminIcon512.rel = 'apple-touch-icon';
    adminIcon512.setAttribute('sizes', '512x512');
    adminIcon512.href = '/icon-admin-512.png?v=4';
    document.head.appendChild(adminIcon512);
    return () => {
      if (manifest) manifest.href = prevManifest;
      adminIcon192.remove();
      adminIcon512.remove();
    };
  }, []);

  // Subscribe to routes
  useEffect(() => {
    const unsub = subscribeToRoutes(r => { if (r.length) setRoutes(r); });
    return () => unsub();
  }, []);

  // Subscribe to payment info
  useEffect(() => {
    const unsub = subscribeToPaymentInfo(info => setPaymentInfo(info));
    return () => unsub();
  }, []);

  // Subscribe to locations from Firestore
  useEffect(() => {
    const unsub = subscribeToLocations((firestorePickups, firestoreDropMap) => {
      if (firestorePickups.length > 0) {
        setPickups(firestorePickups);
        savePickupLocations(firestorePickups);
      }
      if (Object.keys(firestoreDropMap).length > 0) {
        setDropMap(firestoreDropMap);
        saveDropoffMapping(firestoreDropMap);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to cars list from Firestore
  useEffect(() => {
    const unsub = subscribeToCarsListFromFirestore(cars => {
      if (cars.length > 0) setCarsList(cars);
    });
    return () => unsub();
  }, []);

  // Subscribe to company info from Firestore
  useEffect(() => {
    const unsub = subscribeToCompanyInfo(info => {
      setCompanyInfo(info);
      setCompanyInfoInput(info);
      saveCompanyInfoLocal(info);
    });
    return () => unsub();
  }, []);

  // Firestore real-time bookings (only when authenticated)
  const knownBookingIds = React.useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!adminUser) return;
    let unsub: (() => void) | null = null;
    try {
      unsub = subscribeToBookings((firestoreBookings) => {
        setIsRealtime(true);
        saveBookings(firestoreBookings);
        const currentIds = new Set(firestoreBookings.map(b => b.id));
        if (knownBookingIds.current !== null) {
          const brandNew = firestoreBookings.filter(b => !knownBookingIds.current!.has(b.id) && b.status === 'pending');
          if (brandNew.length > 0) {
            setNewBookingsForPopup(brandNew);
            setShowNewBookingPopup(true);
          }
        }
        knownBookingIds.current = currentIds;
        setBookings(firestoreBookings);
      });
    } catch {
      const interval = setInterval(() => setBookings(getBookings()), 2000);
      return () => clearInterval(interval);
    }
    return () => { if (unsub) unsub(); };
  }, [adminUser]);

  // Subscribe to notifications
  useEffect(() => {
    if (!adminUser) return;
    const unsub = subscribeToNotifications(notifs => setNotifications(notifs as NotifDoc[]));
    return () => unsub();
  }, [adminUser]);

  // Subscribe to fare per km
  useEffect(() => {
    const unsub = subscribeToFarePerKm(rate => {
      setFarePerKm(rate);
      setFareRateInput(String(rate));
      saveFarePerKmLocal(rate);
    });
    return () => unsub();
  }, []);

  // Subscribe to working days
  useEffect(() => {
    const unsub = subscribeToWorkingDays(days => {
      setWorkingDays(days);
      setWorkingDaysInput(String(days));
      saveWorkingDaysLocal(days);
    });
    return () => unsub();
  }, []);

  // Load car images from Firestore
  useEffect(() => {
    getCarImagesFromFirestore().then(imgs => {
      if (Object.keys(imgs).length > 0) {
        setCarImages(imgs);
        saveCarImages(imgs);
      }
    });
  }, []);

  // Subscribe to drivers list from Firestore
  useEffect(() => {
    const unsub = subscribeToDriversList(drivers => {
      if (drivers.length >= 0) setDriversList(drivers);
    });
    return () => unsub();
  }, []);

  // Load driver images from Firestore
  useEffect(() => {
    getDriverImagesFromFirestore().then(imgs => {
      if (Object.keys(imgs).length > 0) setDriverImages(imgs);
    });
  }, []);

  // Revenue calculations
  const approvedBookings = bookings.filter(b => b.status === 'approved');
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const totalRevenue = bookings.reduce((sum, b) => sum + parseFareAmount(b.fare), 0);
  const collectedRevenue = approvedBookings.reduce((sum, b) => sum + parseFareAmount(b.fare), 0);
  const pendingRevenue = pendingBookings.reduce((sum, b) => sum + parseFareAmount(b.fare), 0);

  const formatRevenue = (amount: number) => {
    if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return `${amount}`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const approvedCount = bookings.filter(b => b.status === 'approved').length;
  const urgentCount = bookings.filter(b => {
    const days = getDaysUntilDeadline(b.startDate);
    return days !== null && days >= 0 && days <= 3;
  }).length;

  const getSeenIds = (): number[] => JSON.parse(localStorage.getItem('carlift_admin_seen_ids') || '[]');
  const saveSeenIds = (ids: number[]) => localStorage.setItem('carlift_admin_seen_ids', JSON.stringify(ids));

  const updateFaviconBadge = (count: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.src = '/favicon.ico';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      if (count > 0) {
        ctx.beginPath();
        ctx.arc(26, 6, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#e11d48';
        ctx.fill();
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count > 9 ? '9+' : String(count), 26, 6);
      }
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = canvas.toDataURL('image/png');
    };
    img.onerror = () => {
      if (count > 0) {
        ctx.fillStyle = '#e11d48';
        ctx.beginPath(); ctx.arc(16, 16, 14, 0, 2 * Math.PI); ctx.fill();
        ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(count > 9 ? '9+' : String(count), 16, 16);
        let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = canvas.toDataURL('image/png');
      }
    };
  };

  useEffect(() => {
    if (!adminUser) return;
    const badgeCount = unreadCount + pendingCount;
    if (badgeCount > 0) document.title = `(${badgeCount}) CarLift Admin — Pending`;
    else document.title = 'CarLift Admin Panel';
    // Favicon canvas badge (browser tab)
    updateFaviconBadge(badgeCount);
    // PWA App Badge API — shows badge on home-screen icon (iOS 16.4+, Android Chrome)
    if ('setAppBadge' in navigator) {
      if (badgeCount > 0) {
        (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> })
          .setAppBadge(badgeCount).catch(() => {});
      } else {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> })
          .clearAppBadge().catch(() => {});
      }
    }
    return () => {
      if ('clearAppBadge' in navigator) {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> })
          .clearAppBadge().catch(() => {});
      }
    };
  }, [pendingCount, unreadCount, adminUser]);

  const initialPopupShown = React.useRef(false);
  useEffect(() => {
    if (!adminUser || bookings.length === 0) return;
    if (initialPopupShown.current) return;
    if (sessionStorage.getItem('carlift_admin_popup_shown')) return;
    initialPopupShown.current = true;
    sessionStorage.setItem('carlift_admin_popup_shown', '1');
    const seen = getSeenIds();
    const newPending = bookings.filter(b => b.status === 'pending' && !seen.includes(b.id));
    if (newPending.length > 0) {
      setNewBookingsForPopup(newPending);
      setShowNewBookingPopup(true);
    }
  }, [adminUser, bookings.length]);

  const dismissNewBookingPopup = () => {
    const allPendingIds = bookings.filter(b => b.status === 'pending').map(b => b.id);
    const merged = Array.from(new Set([...getSeenIds(), ...allPendingIds]));
    saveSeenIds(merged);
    setShowNewBookingPopup(false);
  };

  // ── Location Handlers ─────────────────────────────────────────────────────
  const addPickup = async () => {
    if (newPickup && !pickups.includes(newPickup)) {
      const updated = [...pickups, newPickup];
      const updatedMap = { ...dropMap, [newPickup]: [] };
      savePickupLocations(updated);
      saveDropoffMapping(updatedMap);
      setPickups(updated);
      setDropMap(updatedMap);
      setNewPickup('');
      await saveLocationsToFirestore(updated, updatedMap);
    }
  };

  const confirmDeletePickup = (p: string) => setDeleteTarget({ type: 'pickup', name: p });
  const confirmDeleteDropoff = (pick: string, drop: string) => setDeleteTarget({ type: 'dropoff', name: drop, parent: pick });

  const executeDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'pickup' && deleteTarget.name === '__ALL_LOCATIONS__') {
      await handleDeleteAllLocations();
      return;
    }
    if (deleteTarget.type === 'pickup') {
      const updated = pickups.filter(l => l !== deleteTarget.name);
      const updatedMap = { ...dropMap };
      delete updatedMap[deleteTarget.name];
      savePickupLocations(updated);
      saveDropoffMapping(updatedMap);
      setPickups(updated);
      setDropMap(updatedMap);
      if (selectedPickupForDrop === deleteTarget.name) setSelectedPickupForDrop('');
      await saveLocationsToFirestore(updated, updatedMap);
    } else if (deleteTarget.type === 'dropoff' && deleteTarget.parent) {
      const updatedMap = { ...dropMap, [deleteTarget.parent]: dropMap[deleteTarget.parent].filter(d => d !== deleteTarget.name) };
      saveDropoffMapping(updatedMap);
      setDropMap(updatedMap);
      await saveLocationsToFirestore(pickups, updatedMap);
    } else if (deleteTarget.type === 'car') {
      const updated = carsList.filter(c => c !== deleteTarget.name);
      setCarsList(updated);
      await saveCarsListToFirestore(updated);
      // Also remove car image if exists
      if (carImages[deleteTarget.name]) {
        const updatedImgs = { ...carImages };
        delete updatedImgs[deleteTarget.name];
        setCarImages(updatedImgs);
        saveCarImages(updatedImgs);
        await saveCarImagesToFirestore(updatedImgs);
        await deleteCarImageFromStorage(deleteTarget.name).catch(() => {});
      }
    }
    setDeleteTarget(null);
  };

  const addDropoff = async () => {
    if (selectedPickupForDrop && newDropoff && !dropMap[selectedPickupForDrop]?.includes(newDropoff)) {
      const updatedMap = { ...dropMap, [selectedPickupForDrop]: [...(dropMap[selectedPickupForDrop] || []), newDropoff] };
      saveDropoffMapping(updatedMap);
      setDropMap(updatedMap);
      setNewDropoff('');
      await saveLocationsToFirestore(pickups, updatedMap);
    }
  };

  const closeAddRoutePopup = () => {
    setShowAddRoutePopup(false);
    setNewRoutePickupInput('');
    setNewRouteDropoffInput('');
    setNewRouteDropoffList([]);
  };

  const addDropoffToNewRoute = () => {
    const d = newRouteDropoffInput.trim();
    if (d && !newRouteDropoffList.includes(d)) {
      setNewRouteDropoffList(prev => [...prev, d]);
      setNewRouteDropoffInput('');
    }
  };

  const handleSaveNewRoute = async () => {
    const pickup = newRoutePickupInput.trim();
    if (!pickup || newRouteDropoffList.length === 0) return;
    setSavingNewRoute(true);
    const updatedPickups = pickups.includes(pickup) ? pickups : [...pickups, pickup];
    const existingDrops = dropMap[pickup] || [];
    const mergedDrops = Array.from(new Set([...existingDrops, ...newRouteDropoffList]));
    const updatedMap = { ...dropMap, [pickup]: mergedDrops };
    setPickups(updatedPickups);
    setDropMap(updatedMap);
    savePickupLocations(updatedPickups);
    saveDropoffMapping(updatedMap);
    await saveLocationsToFirestore(updatedPickups, updatedMap);
    setSavingNewRoute(false);
    closeAddRoutePopup();
  };

  const handleDeleteAllLocations = async () => {
    setDeletingAllLocations(true);
    savePickupLocations([]);
    saveDropoffMapping({});
    setPickups([]);
    setDropMap({});
    setSelectedPickupForDrop('');
    await saveLocationsToFirestore([], {});
    setDeletingAllLocations(false);
    setDeleteTarget(null);
  };

  // ── Status Handler (requires car assignment) ──────────────────────────────
  const updateStatus = async (id: number, status: 'pending' | 'approved') => {
    const booking = bookings.find(b => b.id === id);
    if (status === 'approved' && booking && !booking.assignedCar) {
      setApproveError(id);
      return;
    }
    setApproveError(null);
    const updated = bookings.map(b => b.id === id ? { ...b, status } : b);
    saveBookings(updated);
    setBookings(updated);
    setStatusPopup(null);
    await updateBookingInFirestore(id, { status });
  };

  // ── Account Security ──────────────────────────────────────────────────────
  const reauthCurrentUser = async (currentPassword: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('Not logged in');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
  };

  const handleChangePassword = async () => {
    setSecurityMsg(null);
    if (!securityCurrentPw) { setSecurityMsg({ type: 'err', text: 'Enter your current password.' }); return; }
    if (securityNewPw.length < 8) { setSecurityMsg({ type: 'err', text: 'New password must be at least 8 characters.' }); return; }
    if (!/[A-Z]/.test(securityNewPw)) { setSecurityMsg({ type: 'err', text: 'Password must contain at least one uppercase letter.' }); return; }
    if (!/[0-9!@#$%^&*]/.test(securityNewPw)) { setSecurityMsg({ type: 'err', text: 'Password must contain at least one number or special character.' }); return; }
    if (securityNewPw !== securityConfirmPw) { setSecurityMsg({ type: 'err', text: 'Passwords do not match.' }); return; }
    setSavingPw(true);
    try {
      await reauthCurrentUser(securityCurrentPw);
      await updatePassword(auth.currentUser!, securityNewPw);
      setSecurityMsg({ type: 'ok', text: 'Password updated successfully.' });
      setSecurityCurrentPw(''); setSecurityNewPw(''); setSecurityConfirmPw('');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setSecurityMsg({ type: 'err', text: 'Current password is incorrect.' });
      } else {
        setSecurityMsg({ type: 'err', text: 'Failed to update password. Please try again.' });
      }
    }
    setSavingPw(false);
  };

  const handleChangeEmail = async () => {
    setSecurityMsg(null);
    const newEmail = securityNewEmail.trim().toLowerCase();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setSecurityMsg({ type: 'err', text: 'Enter a valid email address.' }); return;
    }
    if (!securityCurrentPw) { setSecurityMsg({ type: 'err', text: 'Enter your current password to confirm.' }); return; }
    setSavingEmail(true);
    try {
      await reauthCurrentUser(securityCurrentPw);
      await verifyBeforeUpdateEmail(auth.currentUser!, newEmail);
      // Also update the ADMIN_EMAILS whitelist via Firestore for persistence
      await saveUserToFirestore(auth.currentUser!.uid, {
        name: auth.currentUser!.displayName || newEmail.split('@')[0],
        email: newEmail, phone: '', role: 'admin',
      });
      setSecurityMsg({ type: 'ok', text: `Verification email sent to ${newEmail}. Check your inbox and click the link to confirm the new address.` });
      setSecurityNewEmail(''); setSecurityCurrentPw('');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setSecurityMsg({ type: 'err', text: 'Current password is incorrect.' });
      } else if (code === 'auth/email-already-in-use') {
        setSecurityMsg({ type: 'err', text: 'This email is already in use by another account.' });
      } else {
        setSecurityMsg({ type: 'err', text: 'Failed to update email. Please try again.' });
      }
    }
    setSavingEmail(false);
  };

  // ── Car Assignment ────────────────────────────────────────────────────────
  const assignCar = async (id: number, car: string) => {
    const updated = bookings.map(b => b.id === id ? { ...b, assignedCar: car } : b);
    saveBookings(updated);
    setBookings(updated);
    setCarPopup(null);
    await updateBookingInFirestore(id, { assignedCar: car });
  };

  // ── Driver Assignment ─────────────────────────────────────────────────────
  const assignDriver = async (id: number, driverId: string) => {
    const updated = bookings.map(b => b.id === id ? { ...b, assignedDriver: driverId } : b);
    saveBookings(updated);
    setBookings(updated);
    setDriverPopup(null);
    await updateBookingInFirestore(id, { assignedDriver: driverId });
  };

  const unassignDriver = async (id: number) => {
    const updated = bookings.map(b => b.id === id ? { ...b, assignedDriver: '' } : b);
    saveBookings(updated);
    setBookings(updated);
    setDriverPopup(null);
    await updateBookingInFirestore(id, { assignedDriver: '' });
  };

  // ── Driver Management ─────────────────────────────────────────────────────
  const handleAddDriver = async () => {
    const name = newDriverName.trim();
    if (!name) return;
    setAddingDriver(true);
    const newDriver: DriverInfo = { id: `drv_${Date.now()}`, name, phone: newDriverPhone.trim() };
    const updated = [...driversList, newDriver];
    setDriversList(updated);
    await saveDriversListToFirestore(updated);
    setNewDriverName('');
    setNewDriverPhone('');
    setAddingDriver(false);
  };

  const handleDeleteDriver = async (id: string) => {
    const updated = driversList.filter(d => d.id !== id);
    setDriversList(updated);
    await saveDriversListToFirestore(updated);
    if (driverImages[id]) {
      const updatedImgs = { ...driverImages };
      delete updatedImgs[id];
      setDriverImages(updatedImgs);
      await saveDriverImagesToFirestore(updatedImgs);
      const driver = driversList.find(d => d.id === id);
      if (driver) await deleteDriverImageFromStorage(driver.name).catch(() => {});
    }
  };

  const compressAndSaveDriverImage = async (driver: DriverInfo, file: File) => {
    setUploadingDriver(driver.id);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
          const src = e.target?.result as string;
          const img = new window.Image();
          img.onerror = reject;
          img.onload = () => {
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      });
      let imageUrl = base64;
      try {
        imageUrl = await uploadDriverImageToStorage(driver.name, base64);
      } catch {
        imageUrl = base64;
      }
      const updated = { ...driverImages, [driver.id]: imageUrl };
      setDriverImages(updated);
      await saveDriverImagesToFirestore(updated);
    } catch (err) {
      console.error('Driver image upload error:', err);
    } finally {
      setUploadingDriver(null);
    }
  };

  const handleRemoveDriverImage = async (driverId: string) => {
    const updated = { ...driverImages };
    delete updated[driverId];
    setDriverImages(updated);
    await saveDriverImagesToFirestore(updated);
    const driver = driversList.find(d => d.id === driverId);
    if (driver) await deleteDriverImageFromStorage(driver.name).catch(() => {});
  };

  const deleteBooking = async (id: number) => {
    const updated = bookings.filter(b => b.id !== id);
    saveBookings(updated);
    setBookings(updated);
    await deleteBookingFromFirestore(id);
  };

  const sendWhatsApp = (b: Booking) => {
    const waNum = formatWANumber(b.whatsapp);
    const rentalNum = companyInfo.phone ? `\nFor queries call: ${companyInfo.phone}` : '';
    const msg = encodeURIComponent(
      `Dear ${b.name},\n\nYour Car Lift booking (${b.pickup} → ${b.dropoff}) is *${b.status.toUpperCase()}*.\nFare: ${b.fare}\nStart Date: ${b.startDate}${rentalNum}\n\nThank you for choosing ${companyInfo.name || 'Car Lift'}!`
    );
    window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank');
  };

  const handleMarkAllRead = () => {
    notifications.forEach(n => { if (!n.read && n._docId) markNotificationReadInFirestore(n._docId); });
  };

  const handleMarkRead = (id: number) => {
    const n = notifications.find(n => n.id === id);
    if (n?._docId) markNotificationReadInFirestore(n._docId);
  };

  // ── Car Image Upload (Firebase Storage + Firestore) ───────────────────────
  const compressAndSave = async (carName: string, file: File) => {
    setUploadingCar(carName);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
          const src = e.target?.result as string;
          const img = new window.Image();
          img.onerror = reject;
          img.onload = () => {
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      });

      let imageUrl = base64;
      // Try Firebase Storage first
      try {
        imageUrl = await uploadCarImageToStorage(carName, base64);
      } catch (storageErr) {
        console.warn('Firebase Storage upload failed, using base64 fallback:', storageErr);
        imageUrl = base64;
      }

      const updated = { ...carImages, [carName]: imageUrl };
      setCarImages(updated);
      saveCarImages(updated);
      await saveCarImagesToFirestore(updated);
    } catch (err) {
      console.error('Image upload error:', err);
    } finally {
      setUploadingCar(null);
    }
  };

  const handleRemoveCarImage = async (carName: string) => {
    const updated = { ...carImages };
    delete updated[carName];
    setCarImages(updated);
    saveCarImages(updated);
    await saveCarImagesToFirestore(updated);
    await deleteCarImageFromStorage(carName).catch(() => {});
  };

  // ── Cars List Handlers ────────────────────────────────────────────────────
  const handleAddCar = async () => {
    const trimmed = newCarName.trim();
    if (!trimmed || carsList.includes(trimmed)) return;
    setAddingCar(true);
    const updated = [...carsList, trimmed];
    setCarsList(updated);
    await saveCarsListToFirestore(updated);
    setNewCarName('');
    setAddingCar(false);
  };

  // ── Routes Handlers ───────────────────────────────────────────────────────
  const handleAddRoute = async () => {
    if (!newRouteTitle.trim() || !newRouteTiming.trim()) return;
    setSavingRoutes(true);
    const newRoute: RouteData = {
      id: `r${Date.now()}`,
      title: newRouteTitle.trim(),
      timings: newRouteTiming.split(',').map(t => t.trim()).filter(Boolean),
    };
    const updated = [...routes, newRoute];
    setRoutes(updated);
    await saveRoutesToFirestore(updated);
    setNewRouteTitle('');
    setNewRouteTiming('');
    setSavingRoutes(false);
  };

  const handleSaveEditRoute = async () => {
    if (!editingRoute) return;
    setSavingRoutes(true);
    const updated = routes.map(r => r.id === editingRoute.id ? editingRoute : r);
    setRoutes(updated);
    await saveRoutesToFirestore(updated);
    setEditingRoute(null);
    setSavingRoutes(false);
  };

  const handleDeleteRoute = async (id: string) => {
    const updated = routes.filter(r => r.id !== id);
    setRoutes(updated);
    await saveRoutesToFirestore(updated);
  };

  // ── Payment Handler ───────────────────────────────────────────────────────
  const handleSavePayment = async () => {
    setSavingPayment(true);
    await savePaymentInfoToFirestore(paymentInfo);
    setSavingPayment(false);
  };

  // ── Company Info Handler ──────────────────────────────────────────────────
  const handleSaveCompanyInfo = async () => {
    setSavingCompanyInfo(true);
    setCompanyInfo(companyInfoInput);
    saveCompanyInfoLocal(companyInfoInput);
    await saveCompanyInfoToFirestore(companyInfoInput);
    setSavingCompanyInfo(false);
  };

  const activeBookingForCar = bookings.find(b => b.id === carPopup);
  const activeBookingForStatus = bookings.find(b => b.id === statusPopup);
  const activeBookingForDriver = bookings.find(b => b.id === driverPopup);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!adminUser) {
    return <AdminLoginScreen onLogin={() => setForceRecheckKey(k => k + 1)} />;
  }

  const handleAdminLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-background">

      {/* Full Image Popup — Car */}
      {viewCarImage && (
        <FullImagePopup url={viewCarImage.url} carName={viewCarImage.car} onClose={() => setViewCarImage(null)} />
      )}

      {/* Full Image Popup — Driver */}
      {viewDriverImage && (
        <FullImagePopup url={viewDriverImage.url} carName={viewDriverImage.driverName} onClose={() => setViewDriverImage(null)} />
      )}

      {/* New Booking Alert */}
      {showNewBookingPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-card border-2 border-primary rounded-2xl shadow-2xl shadow-primary/30 max-w-md w-full overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-red-400 to-primary animate-pulse" />
            <div className="p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="relative flex-shrink-0">
                  <div className="bg-primary/20 border-2 border-primary/50 p-3.5 rounded-2xl">
                    <Bell className="w-7 h-7 text-primary" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center animate-bounce">
                    {newBookingsForPopup.length}
                  </span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-primary leading-tight">
                    {newBookingsForPopup.length === 1 ? 'New Booking Waiting!' : `${newBookingsForPopup.length} New Bookings Waiting!`}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Pending approval in your dashboard</p>
                </div>
              </div>
              <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
                {newBookingsForPopup.slice(0, 4).map(b => (
                  <div key={b.id} className="flex items-center gap-3 bg-primary/8 border border-primary/20 rounded-xl p-3">
                    <div className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.pickup} → {b.dropoff}</p>
                    </div>
                    <span className="text-xs text-primary font-semibold flex-shrink-0">{b.fare.split('/')[0]}</span>
                  </div>
                ))}
                {newBookingsForPopup.length > 4 && (
                  <p className="text-xs text-center text-muted-foreground pt-1">+{newBookingsForPopup.length - 4} more bookings</p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setActiveTab('bookings'); dismissNewBookingPopup(); }}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all hover:scale-[1.02] shadow-lg shadow-primary/30 flex items-center justify-center gap-2">
                  <CalendarCheck className="w-4 h-4" /> View Bookings
                </button>
                <button onClick={dismissNewBookingPopup}
                  className="px-5 py-3 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-card border-b-2 border-primary px-3 md:px-8 py-3 md:py-5">
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/20 border border-primary/50 p-1.5 md:p-2 rounded-xl">
              <Crown className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div>
              <span className="font-display text-base md:text-lg font-bold text-primary uppercase tracking-wider">Admin Panel</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isRealtime ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-400 font-semibold">
                    <Wifi className="w-2.5 h-2.5" /> Live
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Polling</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)}
                className="relative bg-primary/15 border border-primary/50 p-2 md:p-2.5 rounded-xl hover:bg-primary/25 transition-all hover:scale-105">
                <Bell className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-72 md:w-96 bg-card border-2 border-primary rounded-2xl shadow-2xl z-[3000] animate-fade-in-up overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-border">
                    <h4 className="font-display font-bold text-primary text-base">Notifications</h4>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline font-semibold">Mark all</button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">No notifications yet</div>
                    ) : (
                      notifications.slice(0, 20).map(n => (
                        <button key={n.id} onClick={() => handleMarkRead(n.id)}
                          className={`w-full text-left px-4 py-3 border-b border-border/50 flex items-start gap-3 transition-colors hover:bg-primary/10 ${!n.read ? 'bg-primary/5' : ''}`}>
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-primary' : 'bg-muted'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!n.read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{n.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(n.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (activeTab !== 'bookings') { setActiveTab('bookings'); }
                else { navigate('/'); }
              }}
              className="bg-primary/20 border border-primary text-foreground px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg font-semibold text-xs md:text-sm hover:bg-primary/30 hover:scale-105 transition-all flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{activeTab !== 'bookings' ? 'Dashboard' : 'Home'}</span>
            </button>
            <button onClick={handleAdminLogout} className="bg-destructive/20 border border-destructive/50 text-destructive px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg font-semibold text-xs md:text-sm hover:bg-destructive/30 hover:scale-105 transition-all flex items-center gap-1.5">
              <LogIn className="w-3.5 h-3.5 md:w-4 md:h-4 rotate-180" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Stats — scrollable on mobile */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          <div className="glass-card px-3 py-1.5 text-center min-w-[62px] flex-shrink-0 hover:scale-105 transition-transform">
            <div className="text-lg font-bold text-primary">{bookings.length}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Total</div>
          </div>
          <div className="glass-card px-3 py-1.5 text-center min-w-[62px] flex-shrink-0 hover:scale-105 transition-transform">
            <div className="text-lg font-bold text-orange-400">{pendingCount}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Pending</div>
          </div>
          <div className="glass-card px-3 py-1.5 text-center min-w-[62px] flex-shrink-0 hover:scale-105 transition-transform">
            <div className="text-lg font-bold text-green-400">{approvedCount}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Approved</div>
          </div>
          <div className="glass-card px-3 py-1.5 text-center min-w-[80px] flex-shrink-0 hover:scale-105 transition-transform border-green-500/30">
            <div className="text-lg font-bold text-green-400">Rs {formatRevenue(collectedRevenue)}</div>
            <div className="text-[9px] text-green-400/70 uppercase">Collected</div>
          </div>
          <div className="glass-card px-3 py-1.5 text-center min-w-[80px] flex-shrink-0 hover:scale-105 transition-transform border-orange-500/30">
            <div className="text-lg font-bold text-orange-400">Rs {formatRevenue(pendingRevenue)}</div>
            <div className="text-[9px] text-orange-400/70 uppercase">Pending Rev.</div>
          </div>
          {urgentCount > 0 && (
            <div className="glass-card px-3 py-1.5 text-center min-w-[62px] flex-shrink-0 border-destructive hover:scale-105 transition-transform">
              <div className="text-lg font-bold text-destructive">{urgentCount}</div>
              <div className="text-[9px] text-destructive uppercase">Urgent</div>
            </div>
          )}
        </div>
      </div>

      {showNotifications && <div className="fixed inset-0 z-[2999]" onClick={() => setShowNotifications(false)} />}

      {/* Tab Navigation */}
      <div className="flex gap-1 px-4 md:px-8 pt-5 pb-1">
        {([
          { id: 'bookings', label: 'Bookings', icon: <CalendarCheck className="w-4 h-4" /> },
          { id: 'routes', label: 'Routes', icon: <MapPin className="w-4 h-4" /> },
          { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
        ] as { id: AdminTab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-semibold border-b-2 transition-all ${activeTab === tab.id ? 'bg-card border-primary text-primary' : 'bg-card/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-card'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-8 pt-4">

        {/* ── BOOKINGS TAB ── */}
        {activeTab === 'bookings' && (
          <div className="bg-card border border-border rounded-2xl p-3 md:p-5 overflow-hidden">
            <h3 className="text-primary font-display font-bold text-lg mb-4 pb-3 border-b border-border flex items-center gap-2">
              <CalendarCheck className="w-5 h-5" /> Booking Requests
              {isRealtime && <span className="ml-auto text-xs text-green-400 font-normal flex items-center gap-1"><Wifi className="w-3 h-3" /> Live</span>}
            </h3>
            {bookings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No bookings yet</div>
            ) : (
              <>
                {/* ── Mobile card view (< md) ── */}
                <div className="md:hidden flex flex-col gap-3">
                  {bookings.map(b => {
                    const assignedDriverObj = b.assignedDriver ? driversList.find(d => d.id === b.assignedDriver) : null;
                    return (
                      <div key={b.id} className="bg-background border border-border rounded-xl p-3 flex flex-col gap-2.5">
                        {/* Top row: name + status */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-sm">{b.name}</div>
                            <div className="text-xs text-muted-foreground">{b.whatsapp}</div>
                          </div>
                          <button onClick={() => setStatusPopup(b.id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${b.status === 'approved' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-orange-500/20 border-orange-500 text-orange-400'}`}>
                            {b.status === 'approved' ? 'Approved' : 'Pending'}
                          </button>
                        </div>
                        {/* Route + fare */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{b.pickup} → {b.dropoff}</span>
                          <span className="font-bold text-primary">{b.fare.split('/')[0]}</span>
                        </div>
                        {/* Timing + deadline */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{b.timing}</span>
                          <DeadlineBadge startDate={b.startDate} />
                        </div>
                        {/* Car + Driver assign */}
                        <div className="flex gap-2">
                          <button onClick={() => setCarPopup(b.id)}
                            className="flex-1 py-1.5 px-2 bg-primary/10 border border-primary/30 rounded-lg text-xs font-medium flex items-center gap-1 truncate">
                            {b.assignedCar ? (
                              <>
                                {carImages[b.assignedCar] && <img src={carImages[b.assignedCar]} alt="" className="w-4 h-3 object-cover rounded flex-shrink-0" />}
                                <Car className="w-3 h-3 flex-shrink-0 text-primary" />
                                <span className="truncate">{b.assignedCar.split(' ').slice(0, 3).join(' ')}</span>
                              </>
                            ) : <span className="text-orange-400 flex items-center gap-1"><Car className="w-3 h-3" /> Select Car</span>}
                          </button>
                          <button onClick={() => setDriverPopup(b.id)}
                            className="flex-1 py-1.5 px-2 bg-primary/10 border border-primary/30 rounded-lg text-xs font-medium flex items-center gap-1 truncate">
                            {assignedDriverObj ? (
                              <>
                                {driverImages[assignedDriverObj.id] && <img src={driverImages[assignedDriverObj.id]} alt="" className="w-4 h-4 object-cover rounded-full flex-shrink-0" />}
                                <UserRound className="w-3 h-3 flex-shrink-0 text-primary" />
                                <span className="truncate">{assignedDriverObj.name}</span>
                              </>
                            ) : <span className="text-orange-400 flex items-center gap-1"><UserRound className="w-3 h-3" /> Assign Driver</span>}
                          </button>
                        </div>
                        {/* Invoice number */}
                        <div className="flex items-center gap-1">
                          {editingInvoiceNum === b.id ? (
                            <input autoFocus value={customInvoiceNums[b.id] ?? `INV-${b.id}`}
                              onChange={e => setCustomInvoiceNums(prev => ({ ...prev, [b.id]: e.target.value }))}
                              onBlur={() => setEditingInvoiceNum(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingInvoiceNum(null)}
                              className="flex-1 px-2 py-1 bg-input border border-primary/60 rounded text-xs text-foreground focus:outline-none" />
                          ) : (
                            <button onClick={() => { if (!customInvoiceNums[b.id]) setCustomInvoiceNums(prev => ({ ...prev, [b.id]: `INV-${b.id}` })); setEditingInvoiceNum(b.id); }}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary">
                              <Pencil className="w-2.5 h-2.5" /><span className="font-mono">{customInvoiceNums[b.id] || `INV-${b.id}`}</span>
                            </button>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="flex gap-1.5 pt-1 border-t border-border/50">
                          <button onClick={() => generateInvoicePDF(b, carImages, companyInfo, customInvoiceNums[b.id], driversList, driverImages)} className="flex-1 bg-primary/20 hover:bg-primary/30 p-2 rounded-lg flex items-center justify-center transition-all" title="Download Invoice"><FileText className="w-4 h-4" /></button>
                          <button onClick={() => shareInvoicePDFWhatsApp(b, carImages, companyInfo, customInvoiceNums[b.id], driversList, driverImages, (fn, url) => setWhatsappShareModal({ fileName: fn, waUrl: url }))} className="flex-1 bg-green-600/20 hover:bg-green-600/30 p-2 rounded-lg flex items-center justify-center transition-all" title="Share PDF via WhatsApp"><Share2 className="w-4 h-4 text-green-400" /></button>
                          <button onClick={() => sendWhatsApp(b)} className="flex-1 bg-green-600/10 hover:bg-green-600/20 p-2 rounded-lg flex items-center justify-center transition-all" title="WhatsApp Message"><MessageCircle className="w-4 h-4 text-green-300" /></button>
                          <button onClick={() => deleteBooking(b.id)} className="flex-1 bg-destructive/20 hover:bg-destructive/30 p-2 rounded-lg flex items-center justify-center transition-all" title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop table view (>= md) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="bg-primary/10">
                        <th className="text-left p-3 text-primary text-sm font-semibold">Customer</th>
                        <th className="text-left p-3 text-primary text-sm font-semibold">Route</th>
                        <th className="text-left p-3 text-primary text-sm font-semibold">Fare</th>
                        <th className="text-left p-3 text-primary text-sm font-semibold">Deadline</th>
                        <th className="text-left p-3 text-primary text-sm font-semibold">Status</th>
                        <th className="text-left p-3 text-primary text-sm font-semibold">Car</th>
                        <th className="text-left p-3 text-primary text-sm font-semibold">Driver</th>
                        <th className="text-left p-3 text-primary text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map(b => {
                        const assignedDriverObj = b.assignedDriver ? driversList.find(d => d.id === b.assignedDriver) : null;
                        return (
                          <tr key={b.id} className="border-b border-border hover:bg-primary/5 transition-colors group">
                            <td className="p-3">
                              <div className="font-semibold text-sm">{b.name}</div>
                              <div className="text-xs text-muted-foreground">{b.whatsapp}</div>
                              {b.createdAt && (
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/60">
                                  <CalendarClock className="w-2.5 h-2.5 text-primary/40" />
                                  {formatPKT(b.createdAt)}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="text-sm">{b.pickup} → {b.dropoff}</div>
                              <div className="text-xs text-muted-foreground">{b.timing}</div>
                            </td>
                            <td className="p-3">
                              <span className="text-sm font-semibold text-primary">{b.fare}</span>
                            </td>
                            <td className="p-3">
                              <DeadlineBadge startDate={b.startDate} />
                              <div className="text-[10px] text-muted-foreground mt-0.5">{b.startDate}</div>
                            </td>
                            <td className="p-3">
                              <button onClick={() => setStatusPopup(b.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all hover:scale-105 ${b.status === 'approved' ? 'bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500/30' : 'bg-orange-500/20 border-orange-500 text-orange-400 hover:bg-orange-500/30'}`}>
                                {b.status === 'approved' ? 'Approved' : 'Pending'}
                              </button>
                            </td>
                            <td className="p-3">
                              <button onClick={() => setCarPopup(b.id)}
                                className="px-2 py-1.5 bg-primary/15 border border-primary/50 rounded-lg text-xs font-medium hover:bg-primary/25 hover:scale-105 transition-all max-w-[160px] truncate flex items-center gap-1">
                                {b.assignedCar ? (
                                  <>
                                    {carImages[b.assignedCar] && <img src={carImages[b.assignedCar]} alt="" className="w-5 h-4 object-cover rounded flex-shrink-0" />}
                                    <Car className="w-3 h-3 flex-shrink-0" /><span className="truncate">{b.assignedCar}</span>
                                  </>
                                ) : <span className="text-orange-400">Select Car</span>}
                              </button>
                            </td>
                            <td className="p-3">
                              <button onClick={() => setDriverPopup(b.id)}
                                className="px-2 py-1.5 bg-primary/15 border border-primary/50 rounded-lg text-xs font-medium hover:bg-primary/25 hover:scale-105 transition-all max-w-[140px] truncate flex items-center gap-1">
                                {assignedDriverObj ? (
                                  <>
                                    {driverImages[assignedDriverObj.id] && <img src={driverImages[assignedDriverObj.id]} alt="" className="w-4 h-4 object-cover rounded-full flex-shrink-0" />}
                                    <UserRound className="w-3 h-3 flex-shrink-0" /><span className="truncate">{assignedDriverObj.name}</span>
                                  </>
                                ) : <span className="text-orange-400 flex items-center gap-1"><UserRound className="w-3 h-3" /> Assign</span>}
                              </button>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1.5">
                                {editingInvoiceNum === b.id ? (
                                  <div className="flex items-center gap-1">
                                    <Hash className="w-3 h-3 text-primary flex-shrink-0" />
                                    <input autoFocus value={customInvoiceNums[b.id] ?? `INV-${b.id}`}
                                      onChange={e => setCustomInvoiceNums(prev => ({ ...prev, [b.id]: e.target.value }))}
                                      onBlur={() => setEditingInvoiceNum(null)}
                                      onKeyDown={e => e.key === 'Enter' && setEditingInvoiceNum(null)}
                                      className="w-24 px-1.5 py-1 bg-input border border-primary/60 rounded text-xs text-foreground focus:outline-none focus:border-primary"
                                      placeholder={`INV-${b.id}`} />
                                  </div>
                                ) : (
                                  <button onClick={() => { if (!customInvoiceNums[b.id]) setCustomInvoiceNums(prev => ({ ...prev, [b.id]: `INV-${b.id}` })); setEditingInvoiceNum(b.id); }}
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors" title="Edit invoice number">
                                    <Pencil className="w-2.5 h-2.5" />
                                    <span className="font-mono">{customInvoiceNums[b.id] || `INV-${b.id}`}</span>
                                  </button>
                                )}
                                <div className="flex gap-1.5">
                                  <button onClick={() => generateInvoicePDF(b, carImages, companyInfo, customInvoiceNums[b.id], driversList, driverImages)} className="bg-primary/20 hover:bg-primary/30 hover:scale-110 p-2 rounded-md transition-all" title="Download Invoice PDF"><FileText className="w-4 h-4" /></button>
                                  <button onClick={() => shareInvoicePDFWhatsApp(b, carImages, companyInfo, customInvoiceNums[b.id], driversList, driverImages, (fn, url) => setWhatsappShareModal({ fileName: fn, waUrl: url }))} className="bg-green-600/20 hover:bg-green-600/30 hover:scale-110 p-2 rounded-md transition-all" title="Share Invoice via WhatsApp"><Share2 className="w-4 h-4 text-green-400" /></button>
                                  <button onClick={() => sendWhatsApp(b)} className="bg-green-600/10 hover:bg-green-600/20 hover:scale-110 p-2 rounded-md transition-all" title="Send WhatsApp Text"><MessageCircle className="w-4 h-4 text-green-300" /></button>
                                  <button onClick={() => deleteBooking(b.id)} className="bg-destructive/20 hover:bg-destructive/30 hover:scale-110 p-2 rounded-md transition-all opacity-0 group-hover:opacity-100" title="Delete Booking"><Trash2 className="w-4 h-4 text-destructive" /></button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ROUTES TAB ── */}
        {activeTab === 'routes' && (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
            <div className="bg-card border border-border rounded-2xl p-5">
              <button onClick={() => setRouteExpanded(!routeExpanded)} className="w-full flex justify-between items-center border-b border-border pb-3 mb-5">
                <h3 className="text-primary font-display font-bold text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" /> Route Management
                </h3>
                {routeExpanded ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-primary" />}
              </button>

              {routeExpanded && (
                <>
                  <div className="mb-4">
                    <button
                      onClick={() => setShowAddRoutePopup(true)}
                      className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg shadow-primary/20">
                      <Plus className="w-4 h-4" /> Add New Routes
                    </button>
                  </div>

                  <div className="mb-2">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Pickup Locations</label>
                  </div>
                  <div className="flex flex-col gap-2 mb-6">
                    {pickups.map(p => (
                      <div key={p} className="bg-primary/10 border border-border rounded-lg px-3 py-2.5 flex items-center hover:border-primary hover:bg-primary/15 transition-all">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <MapPin className="w-3.5 h-3.5 text-primary" /> {p}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-4">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Drop-off Locations</label>
                    <div className="flex flex-col gap-1 mb-3">
                      {pickups.map(p => (
                        <button key={p}
                          onClick={() => setSelectedPickupForDrop(selectedPickupForDrop === p ? '' : p)}
                          className={`w-full p-2.5 border rounded-lg text-sm text-left transition-all flex items-center justify-between hover:scale-[1.02] ${selectedPickupForDrop === p ? 'bg-primary/20 border-primary' : 'bg-primary/5 border-border hover:bg-primary/10 hover:border-primary/50'}`}>
                          <span className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-primary" /> {p}
                          </span>
                          <span className="text-xs text-muted-foreground">{(dropMap[p] || []).length} drop-offs</span>
                        </button>
                      ))}
                    </div>

                    {selectedPickupForDrop && (
                      <div className="bg-primary/5 border border-primary/30 rounded-xl p-3 mt-3 animate-fade-in-up">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-primary uppercase">Drop-offs for {selectedPickupForDrop}</span>
                        </div>
                        <div className="flex gap-2 mb-3">
                          <input value={newDropoff} onChange={e => setNewDropoff(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addDropoff()}
                            placeholder="Add dropoff"
                            className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:border-primary focus:outline-none" />
                          <button onClick={addDropoff} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-bold hover:bg-primary/80 transition-colors"><Plus className="w-4 h-4" /></button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {(dropMap[selectedPickupForDrop] || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">No drop-off locations added yet</p>
                          ) : (
                            (dropMap[selectedPickupForDrop] || []).map(d => (
                              <div key={d} className="bg-accent/20 border border-border rounded-lg px-3 py-2 flex items-center justify-between hover:border-primary transition-all group">
                                <span className="flex items-center gap-2 text-sm">
                                  <ChevronRight className="w-3 h-3 text-primary" /> {d}
                                </span>
                                <button onClick={() => confirmDeleteDropoff(selectedPickupForDrop, d)} className="text-destructive/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4 mt-4">
                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Quick Stats</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-primary/10 rounded-lg p-3 text-center">
                        <Users className="w-4 h-4 text-primary mx-auto mb-1" />
                        <div className="text-lg font-bold text-primary">{bookings.length}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Clients</div>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-3 text-center">
                        <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                        <div className="text-lg font-bold text-primary">{pickups.length}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Routes</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Route Overview */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-5 pb-3 border-b border-border flex items-center gap-2">
                <MapPin className="w-5 h-5" /> Route Overview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pickups.map(p => (
                  <div key={p} className="bg-primary/5 border border-border rounded-xl p-4 hover:border-primary transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">{p}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {(dropMap[p] || []).map(d => (
                        <div key={d} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ChevronRight className="w-3 h-3 text-primary/60" /> {d}
                        </div>
                      ))}
                      {(dropMap[p] || []).length === 0 && (
                        <p className="text-xs text-muted-foreground/50 italic">No drop-offs configured</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6">

            {/* ── Account Security ── */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-2 pb-3 border-b border-border flex items-center gap-2">
                <Shield className="w-5 h-5" /> Account Security
              </h3>
              <p className="text-xs text-muted-foreground mb-5">Change your admin login credentials. Current password is always required to confirm any change.</p>

              {securityMsg && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${securityMsg.type === 'ok' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-destructive/10 border border-destructive/30 text-destructive'}`}>
                  {securityMsg.type === 'ok' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  {securityMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Change Password */}
                <div className="bg-primary/5 border border-border rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-1">
                    <EyeOff className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground">Change Password</span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Current Password</label>
                    <div className="relative">
                      <input type={securityShowPw ? 'text' : 'password'} value={securityCurrentPw}
                        onChange={e => setSecurityCurrentPw(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none pr-10" />
                      <button type="button" onClick={() => setSecurityShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {securityShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">New Password</label>
                    <input type="password" value={securityNewPw}
                      onChange={e => setSecurityNewPw(e.target.value)}
                      placeholder="Min 8 chars, 1 uppercase, 1 number/symbol"
                      className="w-full px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Confirm New Password</label>
                    <input type="password" value={securityConfirmPw}
                      onChange={e => setSecurityConfirmPw(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <ul className="text-[10px] text-muted-foreground space-y-0.5 pl-1">
                    <li className={securityNewPw.length >= 8 ? 'text-green-400' : ''}>• At least 8 characters</li>
                    <li className={/[A-Z]/.test(securityNewPw) ? 'text-green-400' : ''}>• At least 1 uppercase letter</li>
                    <li className={/[0-9!@#$%^&*]/.test(securityNewPw) ? 'text-green-400' : ''}>• At least 1 number or special character</li>
                    <li className={securityNewPw === securityConfirmPw && securityNewPw.length > 0 ? 'text-green-400' : ''}>• Passwords match</li>
                  </ul>
                  <button onClick={handleChangePassword} disabled={savingPw}
                    className="mt-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all flex items-center gap-2 disabled:opacity-50">
                    {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {savingPw ? 'Updating...' : 'Update Password'}
                  </button>
                </div>

                {/* Change Email */}
                <div className="bg-primary/5 border border-border rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground">Change Login Email</span>
                  </div>
                  <div className="text-xs text-muted-foreground bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2.5">
                    Current: <span className="text-foreground font-medium">{adminUser?.email || '—'}</span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">New Email Address</label>
                    <input type="email" value={securityNewEmail}
                      onChange={e => setSecurityNewEmail(e.target.value)}
                      placeholder="new@example.com"
                      className="w-full px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Current Password (to confirm)</label>
                    <input type="password" value={securityCurrentPw}
                      onChange={e => setSecurityCurrentPw(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">A verification link will be sent to the new email. Your login address changes only after you click that link.</p>
                  <button onClick={handleChangeEmail} disabled={savingEmail}
                    className="mt-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all flex items-center gap-2 disabled:opacity-50">
                    {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {savingEmail ? 'Sending...' : 'Send Verification Link'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Company Info ── */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-2 pb-3 border-b border-border flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Company Information
              </h3>
              <p className="text-xs text-muted-foreground mb-5">This information appears on all generated invoices. Changes take effect immediately on new invoices.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { key: 'name', label: 'Company Name', placeholder: 'Car Lift', icon: <Building2 className="w-4 h-4" /> },
                  { key: 'tagline', label: 'Tagline / Service Description', placeholder: 'Premium Monthly Car Service', icon: <Settings className="w-4 h-4" /> },
                  { key: 'phone', label: 'Phone / WhatsApp', placeholder: '03089926777', icon: <Phone className="w-4 h-4" /> },
                  { key: 'email', label: 'Email Address', placeholder: '777carcare@gmail.com', icon: <Mail className="w-4 h-4" /> },
                  { key: 'address', label: 'Main Address', placeholder: 'Plot 1/2, North Nazimabad, Karachi', icon: <MapPin className="w-4 h-4" /> },
                  { key: 'address2', label: 'Secondary Address (optional)', placeholder: 'Workshop: Gulistan-e-Johar', icon: <MapPin className="w-4 h-4" /> },
                ] as { key: keyof CompanyInfo; label: string; placeholder: string; icon: React.ReactNode }[]).map(({ key, label, placeholder, icon }) => (
                  <div key={key}>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5 block">
                      {icon} {label}
                    </label>
                    <input
                      value={companyInfoInput[key]}
                      onChange={e => setCompanyInfoInput(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-foreground text-sm focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                ))}
              </div>
              <button onClick={handleSaveCompanyInfo} disabled={savingCompanyInfo}
                className="mt-5 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all flex items-center gap-2 disabled:opacity-50">
                {savingCompanyInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {savingCompanyInfo ? 'Saving...' : 'Save Company Info'}
              </button>
            </div>

            {/* ── Routes Management ── */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-2 pb-3 border-b border-border flex items-center gap-2">
                <MapPin className="w-5 h-5" /> Routes Management
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Add, edit or delete routes. Changes reflect instantly in the user panel.</p>

              <div className="flex flex-col gap-2 mb-5">
                {routes.map(route => (
                  <div key={route.id} className="bg-primary/5 border border-border rounded-xl p-3 hover:border-primary/40 transition-all">
                    {editingRoute?.id === route.id ? (
                      <div className="flex flex-col gap-2">
                        <input value={editingRoute.title} onChange={e => setEditingRoute({ ...editingRoute, title: e.target.value })}
                          placeholder="Route title (From → To)"
                          className="px-3 py-2 bg-input border border-primary/50 rounded-lg text-sm text-foreground focus:border-primary focus:outline-none w-full" />
                        <input value={editingRoute.timings.join(', ')}
                          onChange={e => setEditingRoute({ ...editingRoute, timings: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                          placeholder="Timings (comma-separated)"
                          className="px-3 py-2 bg-input border border-primary/50 rounded-lg text-sm text-foreground focus:border-primary focus:outline-none w-full" />
                        <div className="flex gap-2">
                          <button onClick={handleSaveEditRoute} disabled={savingRoutes}
                            className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/85 transition-all flex items-center gap-1.5 disabled:opacity-50">
                            {savingRoutes ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Save
                          </button>
                          <button onClick={() => setEditingRoute(null)} className="bg-muted px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/80 transition-all">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{route.title}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {route.timings.map((t, i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 text-muted-foreground">
                                <Clock className="w-2.5 h-2.5 text-primary" />{t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => setEditingRoute(route)} className="bg-primary/20 hover:bg-primary/30 p-1.5 rounded-lg transition-all" title="Edit">
                            <Settings className="w-3.5 h-3.5 text-primary" />
                          </button>
                          <button onClick={() => handleDeleteRoute(route.id)} className="bg-destructive/20 hover:bg-destructive/30 p-1.5 rounded-lg transition-all" title="Delete">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Add New Route</p>
                <div className="flex flex-col gap-2">
                  <input value={newRouteTitle} onChange={e => setNewRouteTitle(e.target.value)}
                    placeholder="Route title, e.g. Gulistan-e-Johar → PECHS"
                    className="px-3 py-2.5 bg-input border border-primary/50 rounded-lg text-sm text-foreground focus:border-primary focus:outline-none" />
                  <input value={newRouteTiming} onChange={e => setNewRouteTiming(e.target.value)}
                    placeholder="Timing(s), e.g. 7:30 AM – 1:45 PM, 10:00 AM – 6:00 PM"
                    className="px-3 py-2.5 bg-input border border-primary/50 rounded-lg text-sm text-foreground focus:border-primary focus:outline-none" />
                  <button onClick={handleAddRoute} disabled={savingRoutes || !newRouteTitle.trim() || !newRouteTiming.trim()}
                    className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/85 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {savingRoutes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Route
                  </button>
                </div>
              </div>
            </div>

            {/* ── Fare Rate Per KM ── */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-2 pb-3 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-5 h-5" /> Fare Rate Per KM
              </h3>
              <p className="text-xs text-muted-foreground mb-5">
                Set the per-kilometre rate. Calculates monthly fare using this rate × real driving distance × working days + 11% SRB tax.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Rate (Rs per km)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-sm">Rs</span>
                    <input type="number" min="1" step="1" value={fareRateInput} onChange={e => setFareRateInput(e.target.value)}
                      className="w-full pl-10 pr-16 py-3 bg-input border border-primary/50 rounded-xl text-foreground font-bold text-lg focus:border-primary focus:outline-none transition-colors" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">/km</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs text-muted-foreground">Current: <span className="text-primary font-bold">Rs {farePerKm}/km</span></div>
                  <button onClick={async () => {
                    const rate = parseFloat(fareRateInput);
                    if (!rate || rate < 1) return;
                    setSavingFareRate(true);
                    await saveFarePerKmToFirestore(rate);
                    setFarePerKm(rate);
                    saveFarePerKmLocal(rate);
                    setSavingFareRate(false);
                  }} disabled={savingFareRate || !fareRateInput || parseFloat(fareRateInput) < 1}
                    className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all flex items-center gap-2 disabled:opacity-50">
                    {savingFareRate ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {savingFareRate ? 'Saving...' : 'Save Rate'}
                  </button>
                </div>
              </div>
              <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary font-semibold">Example:</span> At Rs {farePerKm}/km for 10 km — monthly fare = {Math.round(10 * farePerKm * 22 * 1.11).toLocaleString()} PKR
                </p>
              </div>
            </div>

            {/* ── Working Days ── */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-2 pb-3 border-b border-border flex items-center gap-2">
                <CalendarCheck className="w-5 h-5" /> Monthly Working Days
              </h3>
              <p className="text-xs text-muted-foreground mb-5">
                Set the base working days per month (weekdays only). Users can add Saturdays (+4) or Sat &amp; Sun (+8).
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Base Working Days</label>
                  <input type="number" min="1" max="31" step="1" value={workingDaysInput} onChange={e => setWorkingDaysInput(e.target.value)}
                    className="w-full px-4 py-3 bg-input border border-primary/50 rounded-xl text-foreground font-bold text-lg focus:border-primary focus:outline-none transition-colors" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs text-muted-foreground">Current: <span className="text-primary font-bold">{workingDays} days</span></div>
                  <button onClick={async () => {
                    const days = parseInt(workingDaysInput, 10);
                    if (!days || days < 1 || days > 31) return;
                    setSavingWorkingDays(true);
                    await saveWorkingDaysToFirestore(days);
                    setWorkingDays(days);
                    saveWorkingDaysLocal(days);
                    setSavingWorkingDays(false);
                  }} disabled={savingWorkingDays || !workingDaysInput || parseInt(workingDaysInput, 10) < 1}
                    className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all flex items-center gap-2 disabled:opacity-50">
                    {savingWorkingDays ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {savingWorkingDays ? 'Saving...' : 'Save Days'}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Weekdays Only', days: workingDays, color: 'text-muted-foreground' },
                  { label: '+ Saturdays', days: workingDays + 4, color: 'text-amber-400' },
                  { label: '+ Sat & Sun', days: workingDays + 8, color: 'text-primary' },
                ].map(opt => (
                  <div key={opt.label} className="bg-primary/5 border border-primary/15 rounded-lg p-2.5 text-center">
                    <p className={`text-base font-bold ${opt.color}`}>{opt.days}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Payment Info ── */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-2 pb-3 border-b border-border flex items-center gap-2">
                <DollarSign className="w-5 h-5" /> Payment Account Details
              </h3>
              <p className="text-xs text-muted-foreground mb-5">These details show when users tap a payment method in the booking form.</p>
              <div className="flex flex-col gap-4">
                {([
                  { key: 'easypaisa', label: 'Easypaisa', color: 'text-green-400 border-green-500/30 bg-green-500/5' },
                  { key: 'jazzcash', label: 'JazzCash', color: 'text-red-400 border-red-500/30 bg-red-500/5' },
                  { key: 'bankTransfer', label: 'Bank Transfer', color: 'text-blue-400 border-blue-500/30 bg-blue-500/5' },
                ] as const).map(({ key, label, color }) => (
                  <div key={key} className={`border rounded-xl p-4 ${color}`}>
                    <p className="font-bold text-sm mb-3">{label}</p>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-xs uppercase tracking-wider opacity-70 mb-1 block">Account Name</label>
                        <input value={paymentInfo[key].accName}
                          onChange={e => setPaymentInfo(prev => ({ ...prev, [key]: { ...prev[key], accName: e.target.value } }))}
                          placeholder="Account holder name"
                          className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:border-primary focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider opacity-70 mb-1 block">Account Number</label>
                        <input value={paymentInfo[key].accNumber}
                          onChange={e => setPaymentInfo(prev => ({ ...prev, [key]: { ...prev[key], accNumber: e.target.value } }))}
                          placeholder="Account / IBAN number"
                          className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:border-primary focus:outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleSavePayment} disabled={savingPayment}
                className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {savingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {savingPayment ? 'Saving...' : 'Save Payment Details'}
              </button>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Driver Management ── */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-2 pb-3 border-b border-border flex items-center gap-2">
                <UserRound className="w-5 h-5" /> Driver Management
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Add drivers with their name, phone, and photo. Assign them to bookings. Driver details are included in generated invoices.</p>

              {/* Add new driver */}
              <div className="flex flex-col gap-2 mb-5">
                <input value={newDriverName} onChange={e => setNewDriverName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddDriver()}
                  placeholder="Driver full name"
                  className="px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none transition-colors" />
                <div className="flex gap-2">
                  <input value={newDriverPhone} onChange={e => setNewDriverPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddDriver()}
                    placeholder="Phone number (optional)"
                    className="flex-1 px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none transition-colors" />
                  <button onClick={handleAddDriver} disabled={addingDriver || !newDriverName.trim()}
                    className="bg-primary text-primary-foreground px-3 py-2.5 rounded-xl font-bold hover:bg-primary/80 hover:scale-105 transition-all disabled:opacity-50">
                    {addingDriver ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {driversList.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6 italic">No drivers added yet</p>
              )}
              <div className="flex flex-col gap-3">
                {driversList.map(driver => (
                  <div key={driver.id} className="bg-primary/5 border border-border rounded-xl p-3 hover:border-primary/40 transition-all">
                    <div className="flex items-center gap-3">
                      {/* Clickable photo thumbnail */}
                      <button
                        onClick={() => driverImages[driver.id] && setViewDriverImage({ driverName: driver.name, url: driverImages[driver.id] })}
                        className={`flex-shrink-0 ${driverImages[driver.id] ? 'cursor-zoom-in' : 'cursor-default'}`}
                        title={driverImages[driver.id] ? "View full image" : "No photo yet"}>
                        {driverImages[driver.id] ? (
                          <img src={driverImages[driver.id]} alt={driver.name}
                            className="w-12 h-12 object-cover rounded-full border-2 border-primary/30 hover:border-primary transition-colors"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-12 h-12 bg-primary/10 rounded-full border border-border flex items-center justify-center">
                            <UserRound className="w-6 h-6 text-primary/40" />
                          </div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{driver.name}</p>
                        {driver.phone && <p className="text-xs text-muted-foreground">{driver.phone}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {uploadingDriver === driver.id ? (
                            <span className="text-primary flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>
                          ) : driverImages[driver.id] ? (
                            <span className="text-green-400">Photo uploaded</span>
                          ) : 'No photo'}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <label htmlFor={`drv-img-${driver.id}`}
                          className="cursor-pointer bg-primary/20 hover:bg-primary/30 p-1.5 rounded-lg transition-all hover:scale-110 flex items-center"
                          title="Upload photo">
                          {uploadingDriver === driver.id ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 text-primary" />}
                        </label>
                        <input id={`drv-img-${driver.id}`} type="file" accept="image/*" capture="user"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) compressAndSaveDriverImage(driver, file);
                            e.target.value = '';
                          }} />
                        {driverImages[driver.id] && (
                          <button onClick={() => handleRemoveDriverImage(driver.id)}
                            className="bg-destructive/20 hover:bg-destructive/30 p-1.5 rounded-lg transition-all hover:scale-110"
                            title="Remove photo">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteDriver(driver.id)}
                          className="bg-destructive/10 hover:bg-destructive/20 p-1.5 rounded-lg transition-all hover:scale-110 opacity-60 hover:opacity-100"
                          title="Remove driver">
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Car Images + Cars Management ── */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-primary font-display font-bold text-lg mb-2 pb-3 border-b border-border flex items-center gap-2">
                <Car className="w-5 h-5" /> Fleet Management
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Add vehicles to the fleet and upload their photos. Tap the image icon to upload. Tap the photo to view full size.</p>

              {/* Add new car */}
              <div className="flex gap-2 mb-5">
                <input value={newCarName} onChange={e => setNewCarName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCar()}
                  placeholder="Car name, e.g. Suzuki Alto 2024 White ABC 123"
                  className="flex-1 px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none transition-colors" />
                <button onClick={handleAddCar} disabled={addingCar || !newCarName.trim()}
                  className="bg-primary text-primary-foreground px-3 py-2.5 rounded-xl font-bold hover:bg-primary/80 hover:scale-105 transition-all disabled:opacity-50">
                  {addingCar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {carsList.map(car => (
                  <div key={car} className="bg-primary/5 border border-border rounded-xl p-3 hover:border-primary/40 transition-all">
                    <div className="flex items-center gap-3">
                      {/* Clickable thumbnail */}
                      <button
                        onClick={() => carImages[car] && setViewCarImage({ car, url: carImages[car] })}
                        className={`flex-shrink-0 ${carImages[car] ? 'cursor-zoom-in' : 'cursor-default'}`}
                        title={carImages[car] ? "View full image" : "No image yet"}
                      >
                        {carImages[car] ? (
                          <img src={carImages[car]} alt={car}
                            className="w-16 h-11 object-cover rounded-lg border border-primary/30 hover:border-primary transition-colors"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-16 h-11 bg-primary/10 rounded-lg border border-border flex items-center justify-center">
                            <Car className="w-5 h-5 text-primary/40" />
                          </div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{car}</p>
                        <p className="text-xs text-muted-foreground">
                          {uploadingCar === car ? (
                            <span className="text-primary flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>
                          ) : carImages[car] ? (
                            <span className="text-green-400">Image uploaded</span>
                          ) : 'No image'}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <label htmlFor={`car-img-${car.replace(/\s/g, '-')}`}
                          className="cursor-pointer bg-primary/20 hover:bg-primary/30 p-1.5 rounded-lg transition-all hover:scale-110 flex items-center"
                          title="Upload photo">
                          {uploadingCar === car ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 text-primary" />}
                        </label>
                        <input id={`car-img-${car.replace(/\s/g, '-')}`} type="file" accept="image/*" capture="environment"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) compressAndSave(car, file);
                            e.target.value = '';
                          }} />
                        {carImages[car] && (
                          <button onClick={() => handleRemoveCarImage(car)}
                            className="bg-destructive/20 hover:bg-destructive/30 p-1.5 rounded-lg transition-all hover:scale-110"
                            title="Remove image">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        )}
                        <button onClick={() => setDeleteTarget({ type: 'car', name: car })}
                          className="bg-destructive/10 hover:bg-destructive/20 p-1.5 rounded-lg transition-all hover:scale-110 opacity-50 hover:opacity-100"
                          title="Remove car from fleet">
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Details */}
            <div className="flex flex-col gap-6">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-primary font-display font-bold text-lg mb-5 pb-3 border-b border-border flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" /> Revenue Summary
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-4">
                    <div className="bg-primary/20 p-3 rounded-xl"><DollarSign className="w-6 h-6 text-primary" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Generated</p>
                      <p className="text-2xl font-bold text-primary">Rs {totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">per month · {bookings.length} clients</p>
                    </div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-4">
                    <div className="bg-green-500/20 p-3 rounded-xl"><CheckCircle className="w-6 h-6 text-green-400" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Collected (Approved)</p>
                      <p className="text-2xl font-bold text-green-400">Rs {collectedRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{approvedBookings.length} approved bookings</p>
                    </div>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center gap-4">
                    <div className="bg-orange-500/20 p-3 rounded-xl"><Clock className="w-6 h-6 text-orange-400" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Revenue</p>
                      <p className="text-2xl font-bold text-orange-400">Rs {pendingRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{pendingBookings.length} pending bookings</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Car Revenue */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-primary font-display font-bold text-lg mb-5 pb-3 border-b border-border flex items-center gap-2">
                  <Car className="w-5 h-5" /> Per-Vehicle Revenue
                </h3>
                <div className="flex flex-col gap-2">
                  {carsList.map(car => {
                    const carBookings = bookings.filter(b => b.assignedCar === car);
                    if (carBookings.length === 0) return null;
                    const carRevenue = carBookings.reduce((s, b) => s + parseFareAmount(b.fare), 0);
                    return (
                      <div key={car} className="flex items-center gap-3 bg-primary/5 border border-border rounded-lg px-3 py-2.5 hover:border-primary transition-all">
                        {carImages[car] ? (
                          <img src={carImages[car]} alt="" className="w-10 h-7 object-cover rounded flex-shrink-0"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Car className="w-5 h-5 text-primary/60 flex-shrink-0" />
                        )}
                        <span className="flex-1 text-xs font-medium text-foreground truncate">{car}</span>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-primary">Rs {carRevenue.toLocaleString()}</div>
                          <div className="text-[10px] text-muted-foreground">{carBookings.length} booking{carBookings.length > 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    );
                  })}
                  {bookings.filter(b => b.assignedCar).length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">No cars assigned yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>

            {/* ── Danger Zone ── */}
            <div className="bg-card border-2 border-destructive/50 rounded-2xl p-5">
              <h3 className="text-destructive font-display font-bold text-lg mb-2 pb-3 border-b border-destructive/30 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Danger Zone
              </h3>
              <p className="text-xs text-muted-foreground mb-5">Deleting locations is permanent and cannot be undone. All associated drop-off mappings will also be removed.</p>

              {pickups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 italic">No locations configured</p>
              ) : (
                <div className="flex flex-col gap-2 mb-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Delete Individual Locations</p>
                  {pickups.map(p => (
                    <div key={p} className="bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3 flex items-center justify-between hover:border-destructive/40 transition-all group">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <MapPin className="w-3.5 h-3.5 text-destructive/70" /> {p}
                        <span className="text-xs text-muted-foreground">({(dropMap[p] || []).length} drop-off{(dropMap[p] || []).length !== 1 ? 's' : ''})</span>
                      </span>
                      <button
                        onClick={() => confirmDeletePickup(p)}
                        className="bg-destructive/20 hover:bg-destructive/40 px-3 py-1.5 rounded-lg text-xs text-destructive font-semibold transition-all flex items-center gap-1.5 hover:scale-105">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setDeleteTarget({ type: 'pickup', name: '__ALL_LOCATIONS__' })}
                disabled={pickups.length === 0 || deletingAllLocations}
                className="w-full bg-destructive/15 hover:bg-destructive/30 border border-destructive/40 text-destructive py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 hover:scale-[1.01]">
                {deletingAllLocations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deletingAllLocations ? 'Deleting...' : 'Delete All Locations'}
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Status Popup */}
      <PopupModal open={statusPopup !== null} onClose={() => { setStatusPopup(null); setApproveError(null); }} title="Update Booking Status">
        {activeBookingForStatus && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Change status for <span className="text-foreground font-semibold">{activeBookingForStatus.name}</span>
            </p>
            {approveError === activeBookingForStatus.id && (
              <div className="bg-destructive/15 border border-destructive/40 text-destructive text-sm px-4 py-3 rounded-xl flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                A car must be assigned before approving this booking.
              </div>
            )}
            <button onClick={() => updateStatus(activeBookingForStatus.id, 'pending')}
              className={`w-full p-3 my-1.5 border rounded-lg text-left text-sm font-medium transition-all flex items-center gap-3 hover:scale-[1.02] ${activeBookingForStatus.status === 'pending' ? 'bg-primary/30 border-primary' : 'bg-primary/10 border-border hover:bg-primary/20 hover:border-primary'}`}>
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="flex-1">Pending</span>
              {activeBookingForStatus.status === 'pending' && <CheckCircle className="w-4 h-4 text-primary" />}
            </button>
            <button onClick={() => updateStatus(activeBookingForStatus.id, 'approved')}
              className={`w-full p-3 my-1.5 border rounded-lg text-left text-sm font-medium transition-all flex items-center gap-3 hover:scale-[1.02] ${activeBookingForStatus.status === 'approved' ? 'bg-primary/30 border-primary' : 'bg-primary/10 border-border hover:bg-primary/20 hover:border-primary'}`}>
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="flex-1">Approved</span>
              {!activeBookingForStatus.assignedCar && (
                <span className="text-xs text-orange-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Assign car first</span>
              )}
              {activeBookingForStatus.status === 'approved' && <CheckCircle className="w-4 h-4 text-primary" />}
            </button>
          </div>
        )}
      </PopupModal>

      {/* Car Selection Popup */}
      <PopupModal open={carPopup !== null} onClose={() => setCarPopup(null)} title="Assign Vehicle">
        {activeBookingForCar && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Assign car for <span className="text-foreground font-semibold">{activeBookingForCar.name}</span>
            </p>
            <p className="text-xs text-primary/70 mb-3 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Tap the car photo to view full image
            </p>
            {carsList.map(c => (
              <PopupOption
                key={c}
                label={c}
                icon={
                  carImages[c] ? (
                    <img src={carImages[c]} alt="" className="w-10 h-7 object-cover rounded border border-primary/20"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-10 h-7 bg-primary/10 rounded border border-border flex items-center justify-center">
                      <Car className="w-4 h-4 text-primary/40" />
                    </div>
                  )
                }
                active={activeBookingForCar.assignedCar === c}
                onClick={() => assignCar(activeBookingForCar.id, c)}
                onImageClick={carImages[c] ? (e) => { e.stopPropagation(); setViewCarImage({ car: c, url: carImages[c] }); } : undefined}
              />
            ))}
          </div>
        )}
      </PopupModal>

      {/* Driver Assignment Popup */}
      <PopupModal open={driverPopup !== null} onClose={() => setDriverPopup(null)} title="Assign Driver">
        {activeBookingForDriver && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Assign driver for <span className="text-foreground font-semibold">{activeBookingForDriver.name}</span>
            </p>
            {driversList.length === 0 ? (
              <div className="text-center py-6">
                <UserRound className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No drivers added yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Add drivers in the Settings tab first.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-primary/70 mb-3 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> Tap photo to view full image
                </p>
                {activeBookingForDriver.assignedDriver && (
                  <button onClick={() => unassignDriver(activeBookingForDriver.id)}
                    className="w-full mb-3 py-2.5 border border-destructive/40 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2">
                    <X className="w-4 h-4" /> Remove Driver Assignment
                  </button>
                )}
                {driversList.map(d => (
                  <PopupOption
                    key={d.id}
                    label={`${d.name}${d.phone ? ` • ${d.phone}` : ''}`}
                    icon={
                      driverImages[d.id] ? (
                        <img src={driverImages[d.id]} alt="" className="w-10 h-10 object-cover rounded-full border-2 border-primary/20"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 bg-primary/10 rounded-full border border-border flex items-center justify-center">
                          <UserRound className="w-5 h-5 text-primary/40" />
                        </div>
                      )
                    }
                    active={activeBookingForDriver.assignedDriver === d.id}
                    onClick={() => assignDriver(activeBookingForDriver.id, d.id)}
                    onImageClick={driverImages[d.id] ? (e) => { e.stopPropagation(); setViewDriverImage({ driverName: d.name, url: driverImages[d.id] }); } : undefined}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </PopupModal>

      {/* Add New Routes Popup */}
      <PopupModal open={showAddRoutePopup} onClose={closeAddRoutePopup} title="Add New Routes">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 block flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Pickup Location
            </label>
            <input
              value={newRoutePickupInput}
              onChange={e => setNewRoutePickupInput(e.target.value)}
              placeholder="e.g. Gulistan-e-Johar"
              className="w-full px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 block flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5" /> Drop-off Locations
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={newRouteDropoffInput}
                onChange={e => setNewRouteDropoffInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDropoffToNewRoute()}
                placeholder="e.g. PECHS"
                className="flex-1 px-3 py-2.5 bg-input border border-primary/40 rounded-xl text-sm text-foreground focus:border-primary focus:outline-none transition-colors"
              />
              <button
                onClick={addDropoffToNewRoute}
                className="bg-primary text-primary-foreground px-3 py-2 rounded-xl font-bold hover:bg-primary/80 hover:scale-105 transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {newRouteDropoffList.length > 0 ? (
              <div className="flex flex-col gap-1.5 bg-primary/5 border border-primary/20 rounded-xl p-3">
                <p className="text-[10px] text-primary uppercase font-semibold tracking-wider mb-1">Added Drop-offs</p>
                {newRouteDropoffList.map(d => (
                  <div key={d} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-3 h-3 text-primary" /> {d}
                    </span>
                    <button
                      onClick={() => setNewRouteDropoffList(prev => prev.filter(x => x !== d))}
                      className="text-destructive/60 hover:text-destructive transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2 italic">Add at least one drop-off location</p>
            )}
          </div>

          <button
            onClick={handleSaveNewRoute}
            disabled={savingNewRoute || !newRoutePickupInput.trim() || newRouteDropoffList.length === 0}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:bg-primary/85 transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] mt-1">
            {savingNewRoute ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {savingNewRoute ? 'Saving Route...' : 'Save Route'}
          </button>
        </div>
      </PopupModal>

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        itemName={deleteTarget?.name === '__ALL_LOCATIONS__' ? 'ALL locations and drop-offs' : (deleteTarget?.name || '')}
      />

      {/* WhatsApp Desktop Share Modal */}
      {whatsappShareModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setWhatsappShareModal(null)}>
          <div className="bg-card border-2 border-green-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-xl">
                <Share2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">PDF Ready</h3>
                <p className="text-xs text-green-400">WhatsApp Sharing Guide</p>
              </div>
            </div>

            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-foreground font-medium mb-3">Your PDF has been downloaded:</p>
              <p className="text-xs font-mono bg-card border border-border rounded-lg px-3 py-2 text-primary break-all mb-4">{whatsappShareModal.fileName}</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-none">
                <li className="flex gap-2"><span className="text-green-400 font-bold flex-shrink-0">1.</span> Click "Open WhatsApp" below</li>
                <li className="flex gap-2"><span className="text-green-400 font-bold flex-shrink-0">2.</span> In WhatsApp, click the attachment icon (📎)</li>
                <li className="flex gap-2"><span className="text-green-400 font-bold flex-shrink-0">3.</span> Select "Document" and choose the PDF from your Downloads folder</li>
              </ol>
              <p className="text-[10px] text-muted-foreground mt-3 italic">Note: Direct PDF sharing is only available on mobile devices.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { window.open(whatsappShareModal.waUrl, '_blank'); }}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" /> Open WhatsApp
              </button>
              <button onClick={() => setWhatsappShareModal(null)}
                className="bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
