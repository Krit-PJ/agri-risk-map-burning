from zipfile import ZipFile
import xml.etree.ElementTree as ET
from pathlib import Path
import re, json, datetime, collections, math, os
XLSX = Path('/mnt/data/2569-7-20 รวม 67-69 เขต 6.xlsx')
OUTDIR = Path('/mnt/data/hs_import_work/data/hotspot')
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
VALID_PLANTS={'นาข้าว','อ้อย','ข้าวโพดและไร่หมุนเวียน','เกษตรอื่น ๆ','พื้นที่ป่า','อื่น ๆ'}
DISTRICT_ORDER=['เมืองกำแพงเพชร','ไทรงาม','คลองลาน','ขาณุวรลักษบุรี','คลองขลุง','พรานกระต่าย','ลานกระบือ','ทรายทองวัฒนา','ปางศิลาทอง','บึงสามัคคี','โกสัมพีนคร']

def load_shared(z):
    arr=[]
    if 'xl/sharedStrings.xml' not in z.namelist(): return arr
    with z.open('xl/sharedStrings.xml') as f:
        for event, elem in ET.iterparse(f, events=('end',)):
            if elem.tag==NS+'si':
                texts=[]
                for t in elem.iter(NS+'t'):
                    texts.append(t.text or '')
                arr.append(''.join(texts))
                elem.clear()
    return arr

def col_idx(ref):
    m=re.match(r'([A-Z]+)',ref); n=0
    for c in m.group(1): n=n*26+ord(c)-64
    return n-1

def excel_date(v):
    if v in (None,''): return None
    try: days=int(float(v))
    except: return str(v)[:10]
    # Excel windows epoch 1899-12-30
    return (datetime.date(1899,12,30)+datetime.timedelta(days=days)).isoformat()

def parse_maps(maps):
    if not maps: return None,None
    m=re.search(r'q=([\-0-9.]+),([\-0-9.]+)', str(maps))
    if m:
        return float(m.group(1)), float(m.group(2))
    return None,None

def cell_value(c, shared):
    t=c.attrib.get('t')
    v=c.find(NS+'v')
    if t=='inlineStr':
        isel=c.find(NS+'is')
        return ''.join([tt.text or '' for tt in isel.iter(NS+'t')]) if isel is not None else ''
    if v is None: return ''
    val=v.text or ''
    if t=='s':
        try: return shared[int(val)]
        except: return val
    return val

def rows(z, sheet_path, shared):
    with z.open('xl/worksheets/'+sheet_path) as f:
        for event, elem in ET.iterparse(f, events=('end',)):
            if elem.tag==NS+'row':
                vals=[]
                for c in elem.findall(NS+'c'):
                    idx=col_idx(c.attrib['r'])
                    while len(vals)<=idx: vals.append('')
                    vals[idx]=cell_value(c,shared)
                yield vals
                elem.clear()

def workbook_sheets(z):
    ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    relmap={r.attrib['Id']:r.attrib['Target'] for r in rels}
    out={}
    for s in wb.find('m:sheets',ns):
        rid=s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        out[s.attrib['name']]=relmap[rid].replace('worksheets/','')
    return out

def norm(s): return str(s or '').strip()

def process_sheet(z, sheet_name, sheet_path, shared, dataset_year):
    it=rows(z,sheet_path,shared)
    header=next(it)
    header=[norm(h) for h in header]
    idx={h:i for i,h in enumerate(header)}
    required=['hsID','Date','Tambon','Amphoe','Province','LandType','PlantType','Q','X','Y','BaanN','TambonN','AmphoeN','ProvinceN','Maps','เดือน']
    missing=[h for h in required if h not in idx]
    if missing: raise Exception(f'{sheet_name} missing {missing}')
    raw=0; province_count=0; agri_count=0; valid_count=0; dup=0; missing_coord=0
    by_month=collections.Counter(); by_day=collections.Counter(); by_district=collections.Counter(); by_tambon=collections.Counter(); by_plant=collections.Counter(); by_land=collections.Counter()
    features=[]; seen=set(); dedup_removed=[]
    for r in it:
        raw+=1
        def get(col):
            i=idx.get(col); return norm(r[i]) if i is not None and i<len(r) else ''
        if get('Province')!='กำแพงเพชร':
            continue
        province_count+=1
        if get('LandType')!='พื้นที่เกษตร':
            continue
        agri_count+=1
        plant=get('PlantType') or 'อื่น ๆ'
        if plant not in VALID_PLANTS:
            plant='อื่น ๆ'
        valid_count+=1
        hsid=get('hsID')
        if hsid in seen:
            dup+=1; dedup_removed.append(hsid); continue
        seen.add(hsid)
        date=excel_date(get('Date'))
        month=int(float(get('เดือน'))) if get('เดือน') else int(date[5:7])
        year_ad=int(date[:4]) if date else dataset_year-543
        # dataset_year is BE, year_be is date BE
        year_be=year_ad+543
        lat,lon=parse_maps(get('Maps'))
        if lat is None or lon is None:
            try:
                # no reliable X/Y projection conversion available; skip missing coords
                pass
            except: pass
        if lat is None or lon is None:
            missing_coord+=1
            continue
        amph=get('Amphoe')
        tamb=get('Tambon')
        baan=get('BaanN')
        land=get('LandType')
        q=get('Q')
        props={
            'hs_id':hsid,'hsID':hsid,'acq_date':date,'Date':date,'acq_time':'','year_be':year_be,'season_be':dataset_year,'dataset_year_be':dataset_year,
            'province':'กำแพงเพชร','Province':'กำแพงเพชร','__province':'กำแพงเพชร',
            'district':amph,'Amphoe':amph,'__district':amph,
            'subdistrict':tamb,'Tambon':tamb,'__subdistrict':tamb,
            'village':baan,'BaanN':baan,'__village':baan,
            'land_type':land,'LandType':land,
            'plant_type':plant,'PlantType':plant,'crop_type':plant,'crop_type_raw':get('PlantType'),'__crop':plant,'__plant_type':plant,
            'confidence':int(float(q)) if q else None,'Q':q,
            'source':'NASA FIRMS Email Alert - Suomi NPP VIIRS','source_file':XLSX.name,
            'filter_rule':'Province=กำแพงเพชร; LandType=พื้นที่เกษตร; PlantType normalized to allowed groups',
            'month':month,'month_key':f'{year_be}-{month:02d}','day_key':date,
            'TambonN':get('TambonN'),'AmphoeN':get('AmphoeN'),'ProvinceN':get('ProvinceN'),'Maps':get('Maps')
        }
        features.append({'type':'Feature','geometry':{'type':'Point','coordinates':[round(lon,5),round(lat,5)]},'properties':props})
        by_month[f'{year_be}-{month:02d}']+=1
        by_day[date]+=1
        by_district[amph]+=1
        by_tambon[(amph,tamb)]+=1
        by_plant[plant]+=1
        by_land[land]+=1
    features.sort(key=lambda f:(f['properties']['acq_date'],f['properties']['hs_id']))
    fc={'type':'FeatureCollection','name':f'hotspot_{dataset_year}','metadata':{
        'dataset_year_be':dataset_year,'source_file':XLSX.name,
        'filter_rule':'Province=กำแพงเพชร; LandType=พื้นที่เกษตร; PlantType in allowed groups; de-duplicate by hsID',
        'total_features':len(features),'date_min':features[0]['properties']['acq_date'] if features else None,'date_max':features[-1]['properties']['acq_date'] if features else None,
        'province':'กำแพงเพชร','land_type':'พื้นที่เกษตร','plant_types':sorted(VALID_PLANTS)
    },'features':features}
    qa={
      'dataset_year_be':dataset_year,'source_file':XLSX.name,'sheet':sheet_name,
      'raw_rows':raw,'province_kamphaeng_phet_rows':province_count,'province_and_agri_rows':agri_count,'after_plant_normalization_rows':valid_count,
      'duplicates_removed_by_hsID':dup,'missing_coordinate_rows_skipped':missing_coord,'final_feature_count':len(features),
      'date_min':fc['metadata']['date_min'],'date_max':fc['metadata']['date_max'],
      'by_month':dict(sorted(by_month.items())),'by_day_count':len(by_day),'by_day':dict(sorted(by_day.items())),
      'by_district':{k:by_district.get(k,0) for k in DISTRICT_ORDER if k in by_district or True},
      'by_plant_type':dict(by_plant.most_common()),'by_land_type':dict(by_land),
      'sample_tambon_top20':[{'Amphoe':a,'Tambon':t,'count':c} for (a,t),c in by_tambon.most_common(20)],
      'columns_used':['Province','Amphoe','Tambon','BaanN','LandType','PlantType','Date','เดือน','Maps','hsID']
    }
    return fc,qa

if __name__=='__main__':
    with ZipFile(XLSX) as z:
        shared=load_shared(z)
        sheets=workbook_sheets(z)
        allqa={}
        for yr in [2567,2568,2569]:
            fc,qa=process_sheet(z,str(yr),sheets[str(yr)],shared,yr)
            (OUTDIR/f'hotspot_{yr}.geojson').write_text(json.dumps(fc,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
            (OUTDIR/f'hotspot_{yr}_qa.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf-8')
            allqa[str(yr)]=qa
            print(yr, qa['final_feature_count'], qa['date_min'], qa['date_max'], qa['by_month'])
        summary={
          'source_file':XLSX.name,
          'standard_filter':'Province=กำแพงเพชร; LandType=พื้นที่เกษตร; PlantType normalized to allowed groups; de-duplicate by hsID',
          'years':{yr:{'final_feature_count':qa['final_feature_count'],'date_min':qa['date_min'],'date_max':qa['date_max'],'by_month':qa['by_month'],'by_district':qa['by_district'],'by_plant_type':qa['by_plant_type']} for yr,qa in allqa.items()},
          'updated_at':'2026-07-20'
        }
        (OUTDIR/'hotspot_all_years_qa.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
