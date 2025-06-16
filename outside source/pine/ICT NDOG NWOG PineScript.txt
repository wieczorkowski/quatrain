// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("ICT NWOG/NDOG & EHPDA [LuxAlgo]" , overlay = true, max_boxes_count = 500, max_lines_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
show      = input.string('NWOG', 'Show'      , options = ['NWOG', 'NDOG'])
showLast  = input.int(5,         'Amount'    , minval = 1)
showEh    = input(true,          'Show EHPDA')

ogCssBull = input(#5b9cf6,    'Gaps Colors', inline = 'ogcolor', group = 'Style')
ogCssBear = input(#ba68c8,    ''           , inline = 'ogcolor', group = 'Style')
ehpdaCss  = input(color.gray, 'EHPDA'      , inline = 'ehpda'  , group = 'Style')
ehpdaLbl  = input(true        , 'Labels'     , inline = 'ehpda'  , group = 'Style')

//-----------------------------------------------------------------------------}
//UDT's
//-----------------------------------------------------------------------------{
type ogaps
    float[] top
    float[] btm
    float[] avg
    int[]   loc
    int[]   sorted
    box[]   boxes
    line[]  toplines
    line[]  avglines
    line[]  btmlines

type ehpda_display
    line  lvl
    label lbl

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
t = time

method set_area(ogaps id, max, min, avg, css)=>
    id.boxes.unshift(
      box.new(t, max, t+1, min, na, bgcolor = color.new(css, 95), extend = extend.right, xloc = xloc.bar_time))
    
    id.toplines.unshift(
      line.new(t, max, t+1, max, color = color.new(css, 50), extend = extend.right, xloc = xloc.bar_time))
    id.avglines.unshift(
      line.new(t, avg, t+1, avg, color = css, extend = extend.right, style = line.style_dotted, xloc = xloc.bar_time))
    id.btmlines.unshift(
      line.new(t, min, t+1, min, color = color.new(css, 50), extend = extend.right, xloc = xloc.bar_time))

method pop(ogaps id)=>
    if id.boxes.size() > showLast
        id.top.pop(),id.btm.pop(),id.loc.pop(),id.avg.pop()
        id.boxes.pop().delete(),id.toplines.pop().delete()
        id.avglines.pop().delete(),id.btmlines.pop().delete()

method set_ehpda(ogaps id, arrayeh)=>
    for i = 0 to id.boxes.size()-2
        getbtm = id.top.get(id.sorted.get(i))
        gettop = id.btm.get(id.sorted.get(i+1))
        avg = math.avg(getbtm, gettop)

        get_eh = arrayeh.get(i)
        get_eh.lvl.set_xy1(id.loc.get(id.sorted.get(i)), avg)
        get_eh.lvl.set_xy2(t, avg)
        
        if ehpdaLbl
            get_eh.lbl.set_xy(t, avg)

method tolast(array<ehpda_display> id)=>
    for element in id
        element.lvl.set_x2(t)
        element.lbl.set_x(t)

//-----------------------------------------------------------------------------}
//Globale Elements
//-----------------------------------------------------------------------------{
var ogaps_ = ogaps.new(array.new_float(0)
  , array.new_float(0)
  , array.new_float(0)
  , array.new_int(0)
  , array.new_int(0)
  , array.new_box(0)
  , array.new_line(0)
  , array.new_line(0)
  , array.new_line(0))

var ehpda = array.new<ehpda_display>(0)

var tf = show == 'NWOG' ? 'W' : 'D'
dtf = timeframe.change(tf)

if barstate.isfirst
    for i = 0 to showLast-1
        ehpda.push(ehpda_display.new(
          line.new(na, na, na, na, color = ehpdaCss, style = line.style_dashed, xloc = xloc.bar_time)
          , label.new(na, na, str.format('EHPDA', tf), color = color(na), style = label.style_label_left, textcolor = ehpdaCss, size = size.tiny, xloc = xloc.bar_time)
          ))

//-----------------------------------------------------------------------------}
//Detects opening gaps and set boxes
//-----------------------------------------------------------------------------{
if dtf
    max = math.max(close[1], open)
    min = math.min(close[1], open)
    avg = math.avg(max, min)

    ogaps_.top.unshift(max)
    ogaps_.btm.unshift(min)
    ogaps_.avg.unshift(avg)
    ogaps_.loc.unshift(t)
    
    css = open > close[1] ? ogCssBull : ogCssBear
    ogaps_.set_area(max, min, avg, css)
    
    ogaps_.pop()

    ogaps_.sorted := ogaps_.avg.sort_indices()

//-----------------------------------------------------------------------------}
//Set event horizons
//-----------------------------------------------------------------------------{
if showEh
    if dtf and ogaps_.boxes.size() > 2
        ogaps_.set_ehpda(ehpda)
    else
        ehpda.tolast()

//-----------------------------------------------------------------------------}