import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  // Try inserting a minimal test row to see what columns exist
  const { data: testSelect, error: selErr } = await supabase.from('market_comps').select('*').limit(1)
  
  if (selErr) {
    return res.status(500).json({ error: selErr.message, hint: selErr.hint })
  }

  // Return column names from the first row, or empty structure
  const columns = testSelect && testSelect.length > 0 ? Object.keys(testSelect[0]) : 'table exists but is empty'
  
  // Also try a test insert to see what fails
  const testRow = {
    address: '__TEST__', city: 'Test', state: 'NC', comp_type: 'sale',
    market: 'Test', building_sf: 1000, lot_acres: 1.0, year_built: 2000,
    clear_height: 20, docks: 4, price: 500000, price_per_sf: 50,
    rent_psf: 5.0, cap_rate: 7.5, buyer: 'Test', seller: 'Test',
    source: 'test', notes: 'test', comp_date: '2025-01-01',
    latitude: 35.0, longitude: -79.0
  }
  
  const { data: insertData, error: insertErr } = await supabase.from('market_comps').insert(testRow).select()
  
  // Clean up test row if it worked
  if (insertData && insertData.length > 0) {
    await supabase.from('market_comps').delete().eq('address', '__TEST__')
  }

  return res.status(200).json({ 
    columns, 
    rowCount: testSelect ? testSelect.length : 0,
    insertTest: insertErr ? { error: insertErr.message, details: insertErr.details, hint: insertErr.hint } : 'SUCCESS - all columns exist',
    insertedColumns: insertData && insertData.length > 0 ? Object.keys(insertData[0]) : null
  })
}
