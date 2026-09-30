(() => {
  const root = document.querySelector('.learning-path');
  if (!root) return;

  /* Ganti string kosong pada recordingUrl dengan URL video asli tiap modul.
     Format yang paling kompatibel: URL langsung berakhiran .mp4 atau .webm. */
  const modules = [
    { title:'Fundamental Apps Builder Officeless', description:'Konsep dasar platform, environment, dan siklus hidup project.', duration:45, recordingUrl:'', outcomes:['Memahami workspace dan environment','Mengenali siklus hidup project','Menyiapkan fondasi aplikasi pertama'], topics:['Pengenalan Apps Builder','Environment development dan production','Project lifecycle dan deployment'] },
    { title:'Data Modelling', description:'Merancang tabel, relasi, dan struktur data yang skalabel.', duration:60, recordingUrl:'', outcomes:['Menyusun struktur tabel yang efektif','Menentukan tipe relasi antar data','Menghindari duplikasi dan bottleneck data'], topics:['Entity dan atribut','One-to-one, one-to-many, dan many-to-many','Normalisasi dan indeks data'] },
    { title:'Form & Business Logic', description:'Validasi form, alur logic, dan automation.', duration:75, recordingUrl:'', outcomes:['Membangun form yang mudah digunakan','Menerapkan aturan validasi','Menyusun automation untuk alur kerja'], topics:['Struktur dan state form','Validasi input','Trigger, condition, dan automation'] },
    { title:'Role & Permission', description:'Merancang struktur akses berbasis role yang aman dan scalable.', duration:50, recordingUrl:'', outcomes:['Memetakan role pengguna','Menerapkan prinsip least privilege','Menguji akses dan keamanan data'], topics:['Role mapping','Permission per fitur dan data','Skenario pengujian akses'] },
    { title:'Dashboard & Reporting', description:'Membangun visualisasi data dan laporan yang informatif.', duration:65, recordingUrl:'', outcomes:['Menentukan metrik yang relevan','Memilih bentuk visualisasi yang tepat','Menyusun dashboard yang mudah dipahami'], topics:['KPI dan sumber data','Chart dan summary card','Filter serta export laporan'] },
    { title:'Integrasi & Konektor', description:'Menghubungkan Officeless dengan sistem eksternal.', duration:70, recordingUrl:'', outcomes:['Memahami alur pertukaran data','Menyiapkan konektor dan payload','Menangani respons dan kegagalan integrasi'], topics:['Konsep API dan webhook','Mapping payload','Error handling dan retry'] },
    { title:'UI/UX & Reusable Component', description:'Menerapkan pola UI konsisten memakai template & repository (Bagian A & B).', duration:90, recordingUrl:'', outcomes:['Menerapkan pola UI yang konsisten','Menggunakan template secara efisien','Membuat komponen yang dapat digunakan kembali'], topics:['Prinsip UI/UX dasar','Template dan repository','Reusable component bagian A dan B'] },
    { title:'Troubleshooting & Code Review', description:'Mendiagnosis bug umum dan menerapkan checklist review (lihat file Working Trackers, sheet Review Checklist).', duration:60, recordingUrl:'', outcomes:['Mengisolasi penyebab bug umum','Membaca error dan log secara sistematis','Menjalankan Review Checklist sebelum rilis'], topics:['Teknik reproduksi masalah','Debugging dan pembacaan log','Working Trackers dan Review Checklist'] }
  ];

  const list = root.querySelector('#pathList');
  const emptyState = root.querySelector('#emptyState');
  const dialog = root.querySelector('#detailDialog');
  const video = root.querySelector('#recordingVideo');
  const unavailable = root.querySelector('#recordingUnavailable');
  const completed = new Set();
  const surveyAnswers = new Map();
  let activeModule = 0;
  let selectedIndex = null;
  let currentFilter = 'all';

  const formatDuration = minutes => minutes >= 60 ? `${Math.floor(minutes/60)} jam${minutes%60 ? ` ${minutes%60} menit` : ''}` : `${minutes} menit`;
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const getStatus = index => completed.has(index) ? 'completed' : index === activeModule ? 'active' : 'upcoming';
  const statusLabel = status => status === 'completed' ? 'Selesai' : status === 'active' ? 'Berjalan' : 'Belum dimulai';

  function render(){
    list.innerHTML=''; let visibleCount=0;
    modules.forEach((item,index)=>{
      const status=getStatus(index); const visible=currentFilter==='all'||currentFilter===status;
      if(visible) visibleCount++;
      const card=document.createElement('article');
      card.className=`module-card is-${status}`; card.hidden=!visible;
      card.innerHTML=`<div class="module-number" aria-hidden="true">${status==='completed'?'✓':String(index+1).padStart(2,'0')}</div><div class="module-copy"><div class="module-topline"><span class="module-kicker">Modul ${String(index+1).padStart(2,'0')}</span><span class="status-badge ${status}">${statusLabel(status)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="module-meta"><span class="meta-chip">◷ ${formatDuration(item.duration)}</span><span class="meta-chip">▶ ${item.recordingUrl?'Recording tersedia':'Recording belum terhubung'}</span><span class="meta-chip">✓ Survei</span></div></div><div class="module-actions"><button class="action-btn" type="button" data-action="detail" data-index="${index}">Buka modul</button><button class="complete-btn" type="button" data-action="complete" data-index="${index}" aria-label="${status==='completed'?'Batalkan selesai':'Tandai selesai'}: ${escapeHtml(item.title)}" aria-pressed="${status==='completed'}">✓</button></div>`;
      list.appendChild(card);
    });
    emptyState.hidden=visibleCount!==0; updateProgress();
  }

  function updateProgress(){
    const count=completed.size; const percent=Math.round(count/modules.length*100);
    root.querySelector('#progressPercent').textContent=`${percent}%`;
    root.querySelector('#progressCaption').textContent=`${count} dari ${modules.length} modul selesai`;
    root.querySelector('#progressBar').style.width=`${percent}%`;
    root.querySelector('.progress-track').setAttribute('aria-valuenow',String(percent));
  }
  function recalculateActive(){ const next=modules.findIndex((_,i)=>!completed.has(i)); activeModule=next===-1?-1:next; }
  function toggleComplete(index){ completed.has(index)?completed.delete(index):completed.add(index); recalculateActive(); render(); if(selectedIndex===index) root.querySelector('#dialogComplete').textContent=completed.has(index)?'Batalkan selesai':'Tandai selesai'; }
  function setActiveTab(name){ root.querySelectorAll('.detail-tab').forEach(tab=>{const active=tab.dataset.tab===name;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active))}); root.querySelectorAll('.tab-panel').forEach(panel=>panel.hidden=panel.dataset.panel!==name); }
  function makeRatingOptions(container,name,selected){ container.innerHTML=Array.from({length:5},(_,i)=>{const value=i+1,id=`${name}-${value}`;return `<div class="rating-option"><input id="${id}" type="radio" name="${name}" value="${value}" ${Number(selected)===value?'checked':''} required><label for="${id}">${value}</label></div>`}).join(''); }

  function stopVideo(){ video.pause(); video.removeAttribute('src'); video.load(); }
  function setRecording(item){
    stopVideo();
    const url=(item.recordingUrl||'').trim();
    if(url){
      video.src=url; video.hidden=false; unavailable.hidden=true;
      root.querySelector('#recordingSource').textContent=url;
    }else{
      video.hidden=true; unavailable.hidden=false;
      root.querySelector('#recordingSource').textContent='Belum dikonfigurasi';
    }
  }

  function openDetail(index){
    selectedIndex=index; const item=modules[index]; const saved=surveyAnswers.get(index)||{};
    root.querySelector('#detailIndex').textContent=`Modul ${String(index+1).padStart(2,'0')}`;
    root.querySelector('#detailTitle').textContent=item.title;
    root.querySelector('#detailDuration').textContent=`◷ ${formatDuration(item.duration)}`;
    root.querySelector('#detailDescription').textContent=item.description;
    root.querySelector('#detailOutcomes').innerHTML=item.outcomes.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
    root.querySelector('#detailTopics').innerHTML=item.topics.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
    root.querySelector('#dialogComplete').textContent=completed.has(index)?'Batalkan selesai':'Tandai selesai';
    root.querySelector('#surveyFeedback').value=saved.feedback||'';
    root.querySelector('#surveyMessage').hidden=true;
    makeRatingOptions(root.querySelector('#understandingRating'),'understanding',saved.understanding);
    makeRatingOptions(root.querySelector('#relevanceRating'),'relevance',saved.relevance);
    setRecording(item); setActiveTab('overview');
    typeof dialog.showModal==='function'?dialog.showModal():dialog.setAttribute('open','');
  }

  list.addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(!button)return;const index=Number(button.dataset.index);button.dataset.action==='detail'?openDetail(index):toggleComplete(index)});
  root.querySelector('.filters').addEventListener('click',event=>{const button=event.target.closest('.filter-btn');if(!button)return;currentFilter=button.dataset.filter;root.querySelectorAll('.filter-btn').forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});render()});
  root.querySelector('.detail-tabs').addEventListener('click',event=>{const tab=event.target.closest('.detail-tab');if(tab)setActiveTab(tab.dataset.tab)});
  root.querySelector('#surveyForm').addEventListener('submit',event=>{event.preventDefault();if(selectedIndex===null)return;const data=new FormData(event.currentTarget);surveyAnswers.set(selectedIndex,{understanding:data.get('understanding'),relevance:data.get('relevance'),feedback:root.querySelector('#surveyFeedback').value.trim()});const message=root.querySelector('#surveyMessage');message.textContent='Terima kasih, penilaian modul berhasil disimpan.';message.hidden=false});
  function closeDialog(){stopVideo();typeof dialog.close==='function'?dialog.close():dialog.removeAttribute('open')}
  root.querySelector('#closeDialog').addEventListener('click',closeDialog);
  root.querySelector('#cancelDialog').addEventListener('click',closeDialog);
  root.querySelector('#dialogComplete').addEventListener('click',()=>{if(selectedIndex!==null)toggleComplete(selectedIndex)});
  dialog.addEventListener('click',event=>{if(event.target===dialog)closeDialog()});
  root.querySelector('#totalDuration').textContent=`Total ${formatDuration(modules.reduce((sum,item)=>sum+item.duration,0))}`;
  render();
})();
