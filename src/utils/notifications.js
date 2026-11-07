// Push Notification Utilities for PWA

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function showNotification(title, options = {}) {
  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted');
    return;
  }

  const defaultOptions = {
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    vibrate: [200, 100, 200],
    tag: 'crm-notification',
    requireInteraction: false,
    ...options
  };

  // Check if we're in a service worker context
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, defaultOptions);
    });
  } else {
    // Fallback to regular notification
    new Notification(title, defaultOptions);
  }
}

export function showLeadNotification(lead) {
  const title = lead.eventType === 'ReInquiry' 
    ? `🔁 Returning Lead (#${lead.inquiryCount})`
    : '⚡ New Facebook Lead!';

  const body = `${lead.name} - ${lead.primaryNo}\nCampaign: ${lead.campaignName}\nAssigned to: ${lead.assignedAgent}`;

  showNotification(title, {
    body,
    tag: `lead-${lead.id}`,
    data: { leadId: lead.id, url: '/leads' },
    actions: [
      { action: 'view', title: 'View Lead' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: true
  });
}

export function checkNotificationSupport() {
  return {
    supported: 'Notification' in window,
    permission: Notification.permission,
    serviceWorkerSupported: 'serviceWorker' in navigator
  };
}
