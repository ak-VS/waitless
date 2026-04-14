export function getStaffSession() {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('waitless_staff_token');
    const restaurant = localStorage.getItem('waitless_restaurant');
    if (!token || !restaurant) return null;
    return {
      token,
      restaurant: JSON.parse(restaurant)
    };
  } catch {
    return null;
  }
}

export function clearStaffSession() {
  localStorage.removeItem('waitless_staff_token');
  localStorage.removeItem('waitless_restaurant');
}