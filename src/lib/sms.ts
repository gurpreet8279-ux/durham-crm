import { Booking, BookingStatus, Customer } from '../types';

/**
 * Format 24h time to 12h AM/PM
 */
export const formatTime12h = (time?: string) => {
  if (!time) return 'TBD';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

/**
 * Generates an SMS URL compatible with both iOS and Android.
 */
export const getSmsUrl = (phoneNumber: string, message: string): string => {
  // Remove non-digit characters to ensure maximum compatibility with dialers
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
  
  // Detect iOS / macOS / Apple environment
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  
  // iOS Safari / Chrome requires '&body=' instead of '?body='
  const separator = isIOS ? '&' : '?';
  
  return `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
};

/**
 * Opens the SMS messaging application prefilled with a pre-saved message
 * based on the target status update.
 */
export const triggerSmsForStatusChange = (booking: Booking, customer: Customer, nextStatus: BookingStatus): boolean => {
  if (!customer.phoneNumber) return false;

  let message = '';
  const [y, m, d] = booking.date.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const timeStr = formatTime12h(booking.time);

  switch (nextStatus) {
    case 'Confirmed':
      message = `Hello ${customer.fullName},\n\nYour appointment with Durham's Crown Mobile Detailing has been confirmed for ${dateStr} at ${timeStr}.\n\nWe appreciate the opportunity to care for your vehicle and look forward to providing you with exceptional service.\n\nThank you for choosing\nDurham's Crown Mobile Detailing.`;
      break;
    case 'Reminder Sent':
      message = `Hello ${customer.fullName}, this is a reminder that your Durham’s Crown Mobile Detailing appointment is scheduled for ${dateStr} at ${timeStr}. Please ensure your vehicle is accessible and remove any personal belongings before our arrival. We look forward to providing exceptional service.`;
      break;
    case 'On The Way':
      message = `Hello ${customer.fullName},\n\nYour Durham’s Crown Mobile Detailing technician is currently on the way and will be arriving shortly for your scheduled service.\n\nTo ensure the best possible detailing experience, please have your vehicle accessible and remove any personal belongings or valuables from the interior prior to our arrival.\n\nWe appreciate your trust in Durham’s Crown Mobile Detailing and look forward to delivering exceptional care for your vehicle.`;
      break;
    case 'Completed':
      message = `Thank you for choosing Durham’s Crown mobile detailing ! We just wanted to follow up and make sure you were happy with the service. If you have a moment, we’d greatly appreciate a google review—it goes a long way in helping our small business grow, https://search.google.com/local/writereview?placeid=ChIJrd4LoTESpQIRnrIgBZgIU3E&source=g.page.m.ia._&laa=nmx-review-solicitation-ia2\n\nThank you for your support!`;
      break;
    default:
      // No pre-saved message for other statuses
      return false;
  }

  if (message) {
    const smsUrl = getSmsUrl(customer.phoneNumber, message);
    
    // Attempt location redirection inside parent/top to avoid iframe deep-linking blocks
    try {
      window.location.href = smsUrl;
    } catch (e) {
      // Fallback: Programmatic link click targeting parent context
      const link = document.createElement('a');
      link.href = smsUrl;
      link.target = '_parent';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    return true;
  }

  return false;
};
