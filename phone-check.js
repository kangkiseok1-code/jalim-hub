/* phone-check.js — 연락처 입력 검사·표시(순수 함수). 숫자만 9~11자리, 0으로 시작. 서버(request_counsel)도 같은 길이 규칙을 쓴다. */
(function(root){
  function clean(s){ return String(s==null?'':s).replace(/[^0-9]/g,''); }
  function msg(s){
    var d=clean(s);
    if(!d) return '전화번호를 입력해주세요';
    if(d.charAt(0)!=='0'||d.length<9||d.length>11) return '전화번호를 확인해주세요 (예: 010-1234-5678)';
    return '';
  }
  function format(s){
    var d=clean(s);
    if(d.length===11) return d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7);
    if(d.length===10) return d.slice(0,2)==='02'?d.slice(0,2)+'-'+d.slice(2,6)+'-'+d.slice(6):d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
    if(d.length===9&&d.slice(0,2)==='02') return d.slice(0,2)+'-'+d.slice(2,5)+'-'+d.slice(5);
    return d;
  }
  var api={clean:clean,msg:msg,format:format}; if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.PhoneCheck=api;
})(typeof window!=='undefined'?window:this);
