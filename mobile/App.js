import React, { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
         ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { request, localDay } from './src/api';

const shades = ['#a491ff','#5bd8ae','#ffbe85','#ff84aa','#74b9ff'];
const bg = '#0c101b', panel = '#1a2030', text = '#f4f5fc', muted = '#a0abc1', violet = '#a491ff';

Notifications.setNotificationHandler({
  handleNotification: async () => ({shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true}),
});

const Button = ({label, onPress, secondary=false, danger=false, disabled=false, style}) => (
  <Pressable onPress={onPress} disabled={disabled} style={[styles.button,secondary&&styles.buttonSecondary,danger&&styles.buttonDanger,style,disabled&&{opacity:.5}]}>
    <Text style={[styles.buttonText,secondary&&{color:text}]}>{label}</Text>
  </Pressable>
);
const Input = ({label, value, onChangeText, ...other}) => (
  <View style={styles.group}><Text style={styles.label}>{label}</Text>
  <TextInput value={value} onChangeText={onChangeText} placeholderTextColor="#7e89a1" style={styles.input} {...other}/></View>
);
const formatError = error => Alert.alert('Habit Tracker',error.message || 'Что-то пошло не так');

async function syncReminders(habits) {
  // Local scheduled device notifications: no Firebase/remote push credentials needed.
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  if (Platform.OS==='android') await Notifications.setNotificationChannelAsync('habits',{
    name:'Habit reminders',importance:Notifications.AndroidImportance.DEFAULT});
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const habit of habits) {
    if (!habit.reminder_time) continue;
    const [hour,minute] = habit.reminder_time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content:{title:'Пора уделить время привычке ✨',body:habit.title,data:{habitId:habit.id}},
      trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour,minute,
        ...(Platform.OS==='android'?{channelId:'habits'}:{})},
    });
  }
}

export default function App() {
  const [token,setToken]=useState('');
  const [user,setUser]=useState(null);
  const [habits,setHabits]=useState([]);
  const [summary,setSummary]=useState(null);
  const [tab,setTab]=useState('home');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [authMode,setAuthMode]=useState('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [edit,setEdit]=useState(null);
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [reminder,setReminder]=useState('');
  const [color,setColor]=useState(shades[0]);
  const [history,setHistory]=useState(null);

  const api = (path, options={}) => request(path,{...options,token});
  async function refresh(activeToken=token) {
    const day=localDay();
    const [items,overview]=await Promise.all([
      request(`/habits?on=${day}`,{token:activeToken}),
      request(`/stats/summary?days=14&on=${day}`,{token:activeToken})
    ]);
    setHabits(items);setSummary(overview);
    AsyncStorage.setItem('ht_cached_habits',JSON.stringify(items)).catch(()=>{});
    syncReminders(items).catch(()=>{});
  }
  useEffect(()=>{
    (async()=>{
      try {
        const saved=await AsyncStorage.getItem('ht_token');
        if(saved){
          const profile=await request('/auth/me',{token:saved});
          setToken(saved);setUser(profile);
          await refresh(saved);
        }
      }catch(e){
        const cached=await AsyncStorage.getItem('ht_cached_habits').catch(()=>null);
        if(cached)try{setHabits(JSON.parse(cached));}catch{}
        // When offline, cached list remains visible only if session is restored.
      }finally{setLoading(false);}
    })();
  },[]);

  async function auth(){
    if(busy)return;
    setBusy(true);
    try{
      const register=authMode==='register';
      const result=await request(register?'/auth/register':'/auth/login',{
        method:'POST',body:{email,password,...(register?{name}:{})}
      });
      await AsyncStorage.setItem('ht_token',result.access_token);
      setToken(result.access_token);setUser(result.user);setPassword('');setTab('home');
      await refresh(result.access_token);
    }catch(e){formatError(e);}finally{setBusy(false);}
  }
  async function logout(){
    await AsyncStorage.removeItem('ht_token');
    await AsyncStorage.removeItem('ht_cached_habits');
    await Notifications.cancelAllScheduledNotificationsAsync().catch(()=>{});
    setToken('');setUser(null);setHabits([]);setSummary(null);
  }
  function openHabit(h=null){
    setEdit(h?h.id:null);setTitle(h?.title||'');setDescription(h?.description||'');
    setReminder(h?.reminder_time||'');setColor(h?.color||shades[0]);setTab('edit');
  }
  async function saveHabit(){
    if(!title.trim()){Alert.alert('Название не может быть пустым');return;}
    if(reminder&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder)){
      Alert.alert('Время должно быть в формате ЧЧ:ММ, например 09:30');return;
    }
    setBusy(true);
    try{
      await api(edit?`/habits/${edit}`:'/habits',{
        method:edit?'PATCH':'POST',
        body:{title:title.trim(),description:description.trim(),reminder_time:reminder||null,color}
      });
      await refresh();setTab('home');
    }catch(e){formatError(e);}finally{setBusy(false);}
  }
  async function toggle(h){
    try{await api(`/habits/${h.id}/completions/${localDay()}?on=${localDay()}`,{method:h.completed_today?'DELETE':'PUT'});await refresh();}
    catch(e){formatError(e);}
  }
  function deleteHabit(h){
    Alert.alert('Удалить привычку?',`Все отметки «${h.title}» будут удалены.`,[
      {text:'Отмена',style:'cancel'},
      {text:'Удалить',style:'destructive',onPress:async()=>{try{await api(`/habits/${h.id}`,{method:'DELETE'});await refresh();}catch(e){formatError(e);}}}
    ]);
  }
  async function showStats(h){
    try{const v=await api(`/habits/${h.id}/stats?days=28&on=${localDay()}`);setHistory({...v,title:h.title});setTab('history');}
    catch(e){formatError(e);}
  }
  async function enableReminders(){
    try{
      const permission=await Notifications.requestPermissionsAsync();
      if(!permission.granted){Alert.alert('Уведомления отключены','Разрешите уведомления в настройках телефона.');return;}
      await syncReminders(habits);
      Alert.alert('Готово','Ежедневные напоминания по времени привычек включены.');
    }catch(e){formatError(e);}
  }
  async function saveProfile(){
    try{const profile=await api('/auth/me',{method:'PATCH',body:{name:name.trim()}});setUser(profile);Alert.alert('Готово','Имя изменено.');}
    catch(e){formatError(e);}
  }
  if(loading)return <SafeAreaView style={[styles.screen,styles.center]}><ActivityIndicator size="large" color={violet}/></SafeAreaView>;
  if(!user)return <SafeAreaView style={styles.screen}><StatusBar barStyle="light-content"/><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}><ScrollView contentContainerStyle={[styles.auth,styles.padding]} keyboardShouldPersistTaps="handled"><Text style={styles.logo}>✓  habit tracker</Text><Text style={styles.kicker}>МАЛЕНЬКИЕ ШАГИ · БОЛЬШИЕ ПЕРЕМЕНЫ</Text><Text style={styles.authTitle}>{authMode==='register'?'Начни сегодня':'С возвращением!'}</Text><Text style={styles.help}>Привычки, которые станут частью тебя.</Text>{authMode==='register'&&<Input label="Имя" value={name} onChangeText={setName} placeholder="Ваше имя"/>}<Input label="Email" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none"/><Input label="Пароль" value={password} onChangeText={setPassword} placeholder="Не менее 8 символов" secureTextEntry/><Button disabled={busy} label={authMode==='register'?'Зарегистрироваться':'Войти'} onPress={auth}/><Pressable style={styles.swap} onPress={()=>setAuthMode(authMode==='register'?'login':'register')}><Text style={{color:violet,fontWeight:'800'}}>{authMode==='register'?'Уже есть аккаунт? Войти':'Создать аккаунт'}</Text></Pressable></ScrollView></KeyboardAvoidingView></SafeAreaView>;
  const view = (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.padding}>
      <View style={styles.top}><Text style={styles.logo}>✓ habit tracker</Text><Text style={styles.date}>{new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</Text></View>
      {tab==='home'&&<>
        <Text style={styles.kicker}>ТВОЙ ЕЖЕДНЕВНЫЙ ПРОГРЕСС</Text>
        <Text style={styles.title}>Привет, {user.name.split(' ')[0]}! ✨</Text>
        <Text style={styles.help}>Один маленький шаг за раз.</Text>
        <View style={styles.tiles}><View style={styles.tile}><Text style={styles.metric}>{summary?.completed_today||0}/{summary?.total_habits||0}</Text><Text style={styles.tiny}>Сегодня</Text></View><View style={styles.tile}><Text style={styles.metric}>🔥 {summary?.best_streak||0}</Text><Text style={styles.tiny}>Серия дней</Text></View></View>
        <View style={styles.row}><Text style={styles.heading}>Мои привычки</Text><Pressable onPress={()=>openHabit()}><Text style={styles.accent}>＋ Добавить</Text></Pressable></View>
        {!habits.length&&<View style={styles.card}><Text style={styles.help}>🌱 Пока нет привычек. Добавь первую!</Text><Button label="Создать привычку" onPress={()=>openHabit()}/></View>}
        {habits.map(h=><View key={h.id} style={styles.card}><View style={styles.row}><View style={{flex:1,marginRight:12}}><Text style={styles.habitTitle}>{h.title}</Text>{!!h.description&&<Text style={styles.helpSmall}>{h.description}</Text>}<Text style={styles.tiny}>🔥 {h.current_streak} дн. · ✓ {h.total_completions}{h.reminder_time?' · ◷ '+h.reminder_time:''}</Text></View><Pressable accessibilityLabel="Отметить привычку" onPress={()=>toggle(h)} style={[styles.check,h.completed_today&&styles.checked]}><Text style={{color:h.completed_today?'#0b3029':'#ddd',fontWeight:'900',fontSize:24}}>{h.completed_today?'✓':''}</Text></Pressable></View><View style={[styles.row,{marginTop:14,justifyContent:'flex-start',gap:14}]}><Pressable onPress={()=>openHabit(h)}><Text style={styles.action}>✎ Изменить</Text></Pressable><Pressable onPress={()=>showStats(h)}><Text style={styles.action}>▥ Статистика</Text></Pressable><Pressable onPress={()=>deleteHabit(h)}><Text style={[styles.action,{color:'#ff9ab3'}]}>Удалить</Text></Pressable></View></View>)}
      </>}
      {tab==='stats'&&<><Text style={styles.kicker}>АНАЛИТИКА</Text><Text style={styles.title}>Статистика 📊</Text><View style={styles.tiles}><View style={styles.tile}><Text style={styles.metric}>{summary?.total_completions||0}</Text><Text style={styles.tiny}>Всего отметок</Text></View><View style={styles.tile}><Text style={styles.metric}>{summary?.best_streak||0}</Text><Text style={styles.tiny}>Лучшая серия</Text></View></View><View style={styles.card}><Text style={styles.habitTitle}>Последние 14 дней</Text><View style={styles.barChart}>{(summary?.days||[]).map(d=><View key={d.date} style={{alignItems:'center',flex:1}}><View style={[styles.bar,{height:Math.max(4,d.count/Math.max(1,...(summary?.days||[]).map(x=>x.count))*110),opacity:d.count?1:.25}]}/><Text style={styles.barLabel}>{d.date.slice(-2)}</Text></View>)}</View></View><Text style={styles.heading}>По привычкам</Text>{habits.map(h=><Pressable key={h.id} style={styles.card} onPress={()=>showStats(h)}><Text style={styles.habitTitle}>{h.title}</Text><Text style={styles.helpSmall}>Серия {h.current_streak} дней · Всего {h.total_completions} отметок</Text></Pressable>)}</>}
      {tab==='edit'&&<><Text style={styles.kicker}>ПРИВЫЧКИ</Text><Text style={styles.title}>{edit?'Редактировать':'Новая привычка'}</Text><View style={styles.card}><Input label="Название" value={title} onChangeText={setTitle} placeholder="Например, читать 20 минут"/><Input label="Описание" value={description} onChangeText={setDescription} placeholder="Почему это важно?" multiline/><Input label="Напоминание в формате ЧЧ:ММ" value={reminder} onChangeText={setReminder} placeholder="09:30 (необязательно)"/><Text style={styles.label}>Цвет</Text><View style={[styles.row,{justifyContent:'flex-start',gap:10,marginBottom:17}]}>{shades.map(c=><Pressable key={c} onPress={()=>setColor(c)} style={{width:38,height:38,backgroundColor:c,borderRadius:20,borderWidth:color===c?3:0,borderColor:'#fff'}}/>)}</View><Button disabled={busy} label="Сохранить" onPress={saveHabit}/><Button secondary label="Отмена" onPress={()=>setTab('home')} style={{marginTop:9}}/></View></>}
      {tab==='history'&&history&&<><Text style={styles.kicker}>ПРОГРЕСС</Text><Text style={styles.title}>{history.title}</Text><View style={styles.tiles}><View style={styles.tile}><Text style={styles.metric}>🔥 {history.current_streak}</Text><Text style={styles.tiny}>Текущая серия</Text></View><View style={styles.tile}><Text style={styles.metric}>{history.completion_rate}%</Text><Text style={styles.tiny}>За 28 дней</Text></View></View><Text style={styles.heading}>Последние 28 дней</Text><View style={styles.days}>{history.days.map(d=><View key={d.date} style={[styles.day,d.completed&&styles.dayDone]}><Text style={{color:d.completed?'#0b3029':muted,fontWeight:'800'}}>{d.date.slice(-2)}</Text></View>)}</View><Button label="Назад" secondary onPress={()=>setTab('home')}/></>}
      {tab==='profile'&&<><Text style={styles.kicker}>АККАУНТ</Text><Text style={styles.title}>Профиль</Text><View style={styles.card}><Text style={styles.help}>Email: {user.email}</Text><Input label="Имя" value={name||user.name} onChangeText={setName}/><Button label="Сохранить имя" onPress={saveProfile}/></View><View style={styles.card}><Text style={styles.habitTitle}>🔔 Напоминания</Text><Text style={styles.helpSmall}>Ежедневные локальные уведомления на устройстве по времени каждой привычки.</Text><Button label="Разрешить уведомления" onPress={enableReminders} style={{marginTop:14}}/></View><Button danger label="Выйти из аккаунта" onPress={logout}/></>}
    </ScrollView>
  );
  return <SafeAreaView style={styles.screen}><StatusBar barStyle="light-content"/>{view}<View style={styles.bottom}><Pressable onPress={()=>setTab('home')} style={styles.tab}><Text style={[styles.tabText,tab==='home'&&styles.tabActive]}>⌂  Сегодня</Text></Pressable><Pressable onPress={()=>setTab('stats')} style={styles.tab}><Text style={[styles.tabText,tab==='stats'&&styles.tabActive]}>▥  Статистика</Text></Pressable><Pressable onPress={()=>{setName(user.name);setTab('profile');}} style={styles.tab}><Text style={[styles.tabText,tab==='profile'&&styles.tabActive]}>♙  Профиль</Text></Pressable></View></SafeAreaView>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:bg,paddingTop:Platform.OS==='android'?StatusBar.currentHeight:0},
  center:{alignItems:'center',justifyContent:'center'},padding:{padding:20,paddingBottom:54},
  logo:{fontSize:22,color:text,fontWeight:'900',letterSpacing:-1},
  kicker:{fontSize:11,fontWeight:'800',letterSpacing:1.5,color:violet,marginTop:27,marginBottom:10},
  title:{fontSize:30,fontWeight:'900',color:text,marginBottom:8},
  help:{color:muted,fontSize:15,lineHeight:24,marginBottom:21},helpSmall:{color:muted,fontSize:13,lineHeight:21,marginTop:5},
  top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},date:{color:muted,fontSize:13},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  heading:{fontSize:21,fontWeight:'900',color:text,marginVertical:18},accent:{color:violet,fontWeight:'800'},
  tiles:{flexDirection:'row',gap:12,marginTop:10,marginBottom:10},tile:{flex:1,backgroundColor:panel,borderWidth:1,borderColor:'#2d364b',borderRadius:17,padding:22},
  metric:{color:text,fontSize:28,fontWeight:'900'},tiny:{color:muted,fontSize:12,marginTop:6},
  card:{backgroundColor:panel,padding:19,borderRadius:17,borderWidth:1,borderColor:'#2b354a',marginBottom:12},
  habitTitle:{color:text,fontSize:17,fontWeight:'800'},action:{color:violet,fontSize:12,fontWeight:'800'},
  check:{width:48,height:48,borderRadius:24,borderWidth:2,borderColor:'#657188',alignItems:'center',justifyContent:'center'},
  checked:{backgroundColor:'#5bd8ae',borderColor:'#5bd8ae'},
  button:{backgroundColor:'#8872ed',padding:15,borderRadius:12,alignItems:'center',justifyContent:'center',marginVertical:4},
  buttonSecondary:{backgroundColor:'#2c3244'},buttonDanger:{backgroundColor:'#613046'},buttonText:{color:'#fff',fontSize:15,fontWeight:'800'},
  group:{marginVertical:10},label:{color:'#bfc9dc',fontSize:13,fontWeight:'700',marginBottom:8},
  input:{backgroundColor:'#0e1423',color:text,borderColor:'#39435c',borderWidth:1,borderRadius:11,paddingHorizontal:13,paddingVertical:13,fontSize:15,minHeight:48},
  auth:{flexGrow:1,justifyContent:'center',paddingHorizontal:30},authTitle:{color:text,fontSize:35,fontWeight:'900',marginBottom:10},swap:{alignItems:'center',padding:22},
  bottom:{paddingVertical:13,paddingHorizontal:6,borderTopColor:'#293044',borderTopWidth:1,flexDirection:'row',backgroundColor:'#131827'},
  tab:{flex:1,alignItems:'center'},tabText:{color:muted,fontSize:12,fontWeight:'700'},tabActive:{color:violet},
  barChart:{flexDirection:'row',alignItems:'flex-end',height:145,gap:4,marginTop:25},bar:{backgroundColor:violet,width:12,borderTopLeftRadius:5,borderTopRightRadius:5},barLabel:{fontSize:9,color:muted,marginTop:8},
  days:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:20},day:{backgroundColor:'#242d40',width:'12%',aspectRatio:1,alignItems:'center',justifyContent:'center',borderRadius:9},dayDone:{backgroundColor:'#5bd8ae'},
});
