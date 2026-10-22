// The two emails for a booking.
return ($('Booked').first().json.emails || []).map(json => ({ json }));
