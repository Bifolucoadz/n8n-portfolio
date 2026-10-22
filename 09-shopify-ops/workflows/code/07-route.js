// The help tool asked for, as a Store API lookup (both tools start by finding the order).
// @include lib-kettle.js
const i = $('When Called').first().json;
return [{ json: { action: 'find_order', order_number: String(i.order_number || ''), email: String(i.email || ''), tool: i.action } }];
