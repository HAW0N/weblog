if (typeof _bwa !== 'object') {
    _bwa = [];
}

if (typeof window.BWA !== 'object') {
    'use strict'
    window._BWA = (function () {
        var BWA;
        var version = '2.6';    // Collecting Agent Version
        var now = new Date();
        var windowAlias = window,
            documentAlias = document,
            navigatorAlias = navigator,
            screenAlias = screen,
            performanceAlias = windowAlias.performance || windowAlias.mozPerformance || windowAlias.msPerformance || windowAlias.webkitPerformance,
            encodeWrapper = windowAlias.encodeURIComponent,
            decodeWrapper = windowAlias.decodeURIComponent;
        var eventHandlers = [];

        // Product
        var preProc = [];
        var postProc = [['assignEventHandlerOnError'],['assignEventHandlerOnload']];

        function stringifyWrapper(obj) {
            try {
                return JSON.stringify(obj);
            } catch (e) {
                return '';
            }
        }

        function isDefined(property) {
            var propertyType = typeof property;
            return propertyType !== 'undefined';
        }

        function safeDecodeWrapper(url) {
            try {
                return decodeWrapper(url);
            } catch (e) {
                return unescape(url);
            }
        }

        function apply() {
            var context, method, paramArray;
            for (var i=0; i<arguments.length; i++) {
                paramArray = arguments[i];
                context = paramArray.shift();    // tracker
                method = paramArray.shift();     // targetMethod
                if (context[method]) {
                    context[method].apply(context, paramArray);
                } else {
                    console.error('The method \'' + method + '\' is not supported.');
                }
            }
        }

        function stringEndsWith(str, suffix) {
            str = String(str);
            return str.indexOf(suffix, str.length - suffix.length) !== -1;
        }

        function Tracker() {
            var startTimeMilli = now.getTime();
            var apiVersion = version;
            let collectorUrl, apiKey;
            var customerId, domainId, userId;
            var requestUrl = safeDecodeWrapper(windowAlias.location.href),
                referrerUrl = safeDecodeWrapper(getReferrer());
            var xhrTimeout = 10000;
            var confCookiePath = '/',
                confCookieDomain = '',
                configDownloadExtensions = /\.(pdf|doc|docx|xls|xlsx|hwp|hwpx|csv|exe|bin|avi|gif|gz|img|jar|dmg|jpg|jpeg|mp3|mp4|mpg|mov|gz|gzip|ppt|png|pptx|tar|txt|xml|zip|다운로드|download|down)/,
                confCookieIsSecure = false,
                confVisitorCookieTimeout = 31536000000,     // 12 months (365 days)
                confSessionCookieTimeout = 1800000,         // 30 minutes - session timeout
                confIgnoreActionTime = 200;                // 0.2 seconds - ignore actions within 0.2 seconds
            var cookieEnabled;
            var debugFlag = false;  
            let sendDataMap = [];
            let sendDataMapkey = "";
            let cookieUserKeyword = 'MEM_ID';
            var cookieString = document.cookie;
            var cookies = cookieString.split(';');

            function extractUserKeywordFromCookie(){
                var desiredValue = '';
                for (var i = 0; i < cookies.length; i++) {
                    var cookie = cookies[i].trim();
                    if (cookie.startsWith(cookieUserKeyword)) {
                        desiredValue = cookie.substring(cookieUserKeyword.length + 1);
                        return desiredValue;
                    }else{
                        desiredValue = '';
                        }
                }
                return desiredValue;
            }

            function generateUuid() {
                function randomStr() {
                    return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
                }
                function currentTimeStr() {
                    return new String(startTimeMilli).substring(1);
                }
                return randomStr() + randomStr()
                    + '-' + randomStr() + '-' + randomStr() + '-' + randomStr()
                    + '-' + currentTimeStr();
            }

            function checkCookies() {
                if (isDefined(cookieEnabled)) {
                    return cookieEnabled;
                }
                if (!isDefined(navigatorAlias.cookieEnabled)) {
                    var cookieName = getCookieName('checkCookie');
                    setCookie(cookieName, '1');
                    cookieEnabled = getCookie(cookieName) === '1' ? true : false;
                    return cookieEnabled;
                }
                cookieEnabled = navigatorAlias.cookieEnabled ? true : false;
                return cookieEnabled;
            }

            function getCookieName(baseName) {
                return '_pk_' + baseName
                    + '.' + customerId
                    + (domainId ? '.' + domainId : '');
            }

            function setCookie(cookieName, value, msToExpire, path, domain, isSecure) {
                if (!checkCookies()) {
                    return;
                }
                var expiryDate;
                if (msToExpire) {
                    expiryDate = new Date();
                    expiryDate.setTime(expiryDate.getTime() + msToExpire);
                }
                documentAlias.cookie = cookieName + '=' + encodeWrapper(value) +
                    (msToExpire ? ';expires=' + expiryDate.toGMTString() : '') +
                    ';path=' + (path || '/') +
                    (domain ? ';domain=' + domain : '') +
                    (isSecure ? ';secure' : '');
            }

            function setVisitorCookie(cookieObj) {
                if (!checkCookies()) {
                    return;
                }
                var data =  cookieObj.u + '.' +      // uuid
                            cookieObj.uct + '.' +    // uuid creation time
                            cookieObj.s + '.' +      // session id
                            cookieObj.sct + '.' +    // session id creation time
                            cookieObj.lvt + '.' +    // last visit timestamp
                            cookieObj.vc;            // visit count
                if (debugFlag) {
                    console.log('setCookie : ' + stringifyWrapper(data));
                }
                setCookie(getCookieName('id'), data, confVisitorCookieTimeout, confCookiePath, confCookieDomain, confCookieIsSecure);
            }

            function getCookie(cookieName) {
                if (!checkCookies()) {
                    return null;
                }
                var cookiePattern = new RegExp('(^|;)[ ]*' + cookieName + '=([^;]*)');
                var cookieMatch = cookiePattern.exec(documentAlias.cookie);
                return cookieMatch ? decodeWrapper(cookieMatch[2]) : null;
            }

            function getVisitorCookie() {
                var visitorCookie = getCookie(getCookieName('id'));
                if (debugFlag) {
                    console.log('getCookie : ' + stringifyWrapper(visitorCookie));
                }
                var visitorObj;
                if (visitorCookie) {
                    var arr = visitorCookie.split('.');
                    visitorObj = {
                        nv: 'N',            // revisit
                        u: arr[0],          // uuid
                        uct: arr[1],        // uuid creation time(cookie creation time)
                        ns: 'N',            // new session
                        s: arr[2],          // session id
                        sct: arr[3],        // sid creation time
                        lvt: arr[4],        // last visit timestamp
                        vc: arr[5]          // visit count
                    }
                    // check session timeout
                    if (startTimeMilli - visitorObj.lvt > confSessionCookieTimeout) {
                        // create new session
                        visitorObj.ns = 'Y';
                        visitorObj.s = generateUuid();
                        visitorObj.sct = startTimeMilli;
                        visitorObj.lvt = startTimeMilli;
                        visitorObj.vc = 0;
                    }
                } else {
                    visitorObj = {
                        nv: 'Y',                // new visit
                        u: generateUuid(),      // uuid
                        uct: startTimeMilli,    // uuid creation time(cookie creation time)
                        ns: 'Y',                // new session
                        s: generateUuid(),      // session id
                        sct: startTimeMilli,    // sid creation time
                        lvt: startTimeMilli,    // last visit timestamp
                        vc: 0                   // visit count
                    };
                }
                return visitorObj;
            }

            function getReferrer() {
                var referrer = '';
                try {
                    referrer = windowAlias.top.document.referrer;
                } catch (e) {
                    if (windowAlias.parent) {
                        try {
                            referrer = windowAlias.parent.document.referrer;
                        } catch (e2) {
                            referrer = '';
                        }
                    }
                }
                if (referrer === '') {
                    referrer = documentAlias.referrer;
                }
                return referrer;
            }

            function handleOnLoadEvent() {
                                  
                    if (!collectorUrl) {
                        console.error('handleOnLoadEvent: collectorUrl is not set!');
                        return;
                    }
    
                    // cookie : Visitor History
                    var visitorObj = getVisitorCookie();
                    var sendFlag = false;
                    if (visitorObj.nv === 'Y' || visitorObj.ns == 'Y' || (startTimeMilli - visitorObj.lvt  > confIgnoreActionTime)) {
                        sendFlag = true;    // send tracking data
                        visitorObj.vc++;
                    }else if(startTimeMilli - visitorObj.lvt  == 0){
                        sendFlag = true;
                    };

                    // update cookie
                    var lastVisitTime = visitorObj.lvt;
                    visitorObj.lvt = startTimeMilli;
                    setVisitorCookie(visitorObj);
                    visitorObj.lvt = lastVisitTime;

                    if (sendFlag) {
                        var data = makeRequestKeyData(visitorObj);
                        // request data
                        sendRequest(collectorUrl + 'defaultData', data);
                    }
            }

            function handleOnErrorEvent(event) {
                if (!collectorUrl) {
                    console.error('handleOnErrorEvent: collectorUrl is not set!');
                    return;
                }

                if (debugFlag) {
                    console.log('>>> onerror event occurred');
                }

                var data = makeRequestDataOnError(event, getVisitorCookie());
                // send data to collector
                //if (data) {
                //    sendRequest(collectorUrl + 'errorData', data);
                //}
            }

            function handleOnActionEvent(url) {
                sendRequest(url, null)
            }

            function makeRequestKeyData(visitorObj) {
                var data = {};
                data.av = apiVersion;    // collect(av) : api version
                data.ak = apiKey;        // collect(ak) : api key
                
                var timing;
                if (performanceAlias && performanceAlias.timing) {
                    timing = performanceAlias.timing;
                }

                // collect(ns) : request start time
                if (timing && timing.navigationStart) {
                    data.ns = timing.navigationStart;
                } else {
                    data.ns = startTimeMilli;
                }
                data.vt = visitorObj.nv;
                data.st = startTimeMilli;
                data.uu = visitorObj.u;
                data.rq = encodeWrapper(requestUrl);
                data.rf = encodeWrapper(referrerUrl);
                if (navigatorAlias) {
                    try {
                        data.lg = navigatorAlias.language;
                        data.ua = navigatorAlias.userAgent;
                        data.pl = navigatorAlias.platform;
                        
                    } catch (e) {
                        console.error('occurred error while handling navigator informations.');
                    }
                }
                // collect(ss) : visitor screen size(width:height)
                data.ss = parseInt(screenAlias.width, 10) + ':' + parseInt(screenAlias.height, 10);

                // session information
                data.ssNs = visitorObj.ns;                      // collect(ssNs) : is new session?
                data.ssId = visitorObj.s;                       // collect(ssId) : session id
                data.ssRi = startTimeMilli - visitorObj.lvt;    // collect(ssRi) : revisit interval
                data.ssVc = visitorObj.vc;                      // collect(ssVc) : visit count
                return data;
            }

            function makeRequestDataOnLoad(beforeData){
                if (window.performance && window.performance.getEntriesByType) {
                    var perfEntries = window.performance.getEntriesByType("navigation");
                    if (perfEntries && perfEntries.length) {
                      beforeData.tm = {};
                      var navigationEntry = perfEntries[0];
                      try {
                        // 네트워크 시간
                        var networkTime = navigationEntry.responseStart - navigationEntry.requestStart;
                        beforeData.tm.nt = (networkTime).toFixed(2);
                        // 서버 시간
                        var serverTime = navigationEntry.responseStart - navigationEntry.startTime;
                        beforeData.tm.st = (serverTime).toFixed(2);
                        // 전송 시간
                        var transferTime = navigationEntry.responseEnd - navigationEntry.responseStart;
                        beforeData.tm.tt = (transferTime).toFixed(2);
                        // DOM 처리 시간
                        var domProcessingTime = navigationEntry.domInteractive - navigationEntry.responseEnd;
                        beforeData.tm.dpt = (domProcessingTime).toFixed(2);
                        // DOM 완료 시간
                        var domCompleteTime = navigationEntry.domComplete - navigationEntry.domInteractive;
                        beforeData.tm.dct = (domCompleteTime).toFixed(2);
                        // onload 이벤트 시간
                        var onloadTime = navigationEntry.loadEventEnd - navigationEntry.loadEventStart;
                        beforeData.tm.olt = (onloadTime).toFixed(2);
                        // 페이지 로딩 시간
                        beforeData.tm.plt = (navigationEntry.duration).toFixed(2);
                    } catch (e) {
                        console.error('could not access to timing information.');
                    }
                    }
                }
                return beforeData;
            }

            function makeRequestDataOnError(event, visitorObj) {
                var data = makeRequestKeyData(visitorObj);
                // errorMsg(em), occurredTime(ot), occurredPosition(op), errorStack(es)
                data.em = event.message? event.message : (event.type ? event.type : event),
                    data.ot = event.message?(event.timeStamp + window.performance.timing.navigationStart) : event.timeStamp,
                    data.op = event.lineno + ":" + event.colno
                if (event.error && event.error.stack) {
                    data.es = event.error.stack;
                }
                return data;
            }

            function sendRequest(url, data) {
                if(navigatorAlias.sendBeacon){
                    var sender = sendBeaconRequestSender(url, data);
                }else if(!navigatorAlias.sendBeacon){
                    var sender = createCorsRequestSender(url, "POST");
                }
                if (!sender) {
                    return;
                }
                if (debugFlag) {
                    console.log('>>> sendRequest : ' + stringifyWrapper(data));
                }
                try {
                    if(navigatorAlias.sendBeacon){
                        return sender;
                    }
                    else{
                        data = secondTimeCheck(url, data);
                        visibilityCheck(data);
                        data.usid = extractUserKeywordFromCookie();
                        //data.skw = extractSearchKeywordFromCookie();
                        sender.send(stringifyWrapper(data));
                    }
                } catch (e) {
                    console.error('error occurred while sending the request.');
                }
            }
            function visibilityCheck(data){
                
                if(typeof data.lt === 'undefined' && typeof data.skw === 'undefined'){
                    if(documentAlias.visibilityState === 'visible'){
                        data.vs = 'vs';
                        var entryTime = new Date();
                        data.vstm = entryTime.getTime();
                    }else if(typeof data.ld === 'undefined' && documentAlias.visibilityState === 'hidden'){
                        data.vs = 'hd';
                        var exitTime = new Date();
                        var duration = exitTime - data.vstm;
                        data.pst = Number(duration);
                        delete data.vstm;
                    }
                }else{
                    data.vs = '-1';
                }
            }
            function secondTimeCheck(url, data) {
                let beforeData = sendDataMap[sendDataMapkey];
                //beforeData가 있으면 beforeData를 data로 넣어주기
                if(typeof beforeData !== 'undefined'){
                    delete beforeData.skw;
                    if(typeof data === 'string'){
                        beforeData.skw = data;
                    }
                    if(typeof beforeData.ld !== 'undefined'){
                            makeRequestDataOnLoad(beforeData);
                    }else if(typeof beforeData.ld === 'undefined'){
                        delete beforeData.tm;
                    }
                    delete beforeData.ld;
                    delete beforeData.lt;
                    delete beforeData.ln;
                    delete beforeData.lu;
                    delete beforeData.pst;

                    if(data && typeof data.lu !== 'undefined'){
                        beforeData = setDataFromLinkData(data, beforeData);
                    }
                    data = beforeData;
                }else{
                    //navigation - navigate, reload, back_forward 데이터 삽입과 uid를 map에 넣어주기
                    var ld = windowAlias.performance.getEntriesByType('navigation')[0]
                    data.ld = ld.type;
                    if(ld.type === 'navigate'){
                        data.ld = 'ng';
                    }else if(ld.type === 'reload'){
                        data.ld = 'rl';
                    }else if(ld.type === 'back_forward'){
                        data.ld = 'bf';
                    }
                    sendDataMapkey = generateUuid();
                    sendDataMap[sendDataMapkey] = data;
                }
                return data;
            }

            function setDataFromLinkData(data, beforeData) {
                // link data 경우에만 활용
                if(typeof data.lu !== 'undefined'){
                    beforeData.lt = data.lt;
                    beforeData.lu = data.lu;
                    if(data.lt === 'dl'){
                        beforeData.ln = data.lx;
                    }else if(typeof data !== 'undefined'){
                        beforeData.ln = data.lte;
                    }
                }
                return beforeData;
            }

            function sendBeaconRequestSender(url, data) {
                data = secondTimeCheck(url, data);
                visibilityCheck(data);
                data.usid = extractUserKeywordFromCookie();
                //data.skw = extractSearchKeywordFromCookie();
                var header = {type: 'application/json;'};
                var payload = JSON.stringify(data);
                try {
                    var blob = new Blob([payload], header);
                    navigatorAlias.sendBeacon(url, blob);
                } catch (e) {
                    console.error('error occurred while sending beacon request');
                return false;
                }
                return true;
            }

            function createCorsRequestSender(url, method) {
                try {
                        var xhr = new windowAlias.XMLHttpRequest();
                        if ("withCredentials" in xhr) {
                            // XHR for Chrome/Firefox/Opera/Safari
                            xhr.open(method, url, true);
                        }else if(typeof windowAlias.XDomainRequest !== 'undefined') {
                            // XDomainRequest for IE
                            xhr = new windowAlias.XDomainRequest();
                            xhr.open(method, url);
                        }else if(typeof windowAlias.ActiveXObject !== 'undefined'){
                            xhr = new windowAlias.ActiveXObject('Microsoft.XMLHTTP');
                        }else {
                            var errmsg = 'CORS not supported(';
                            if (navigatorAlias) {
                                try {
                                errmsg += navigatorAlias.userAgent + '/' + navigatorAlias.platform;
                                } catch (e) {}
                            }
                            errmsg += ')';
                            console.error(errmsg);
                            return null;
                        }
                        xhr.timeout = xhrTimeout;
                        xhr.addEventListener('load', function() {});
                        xhr.onerror = function() { console.error('There was an error making the request.'); };
                } catch (e) {
                    console.error('error occurred while creating CorsRequestSender.');
                    return null;
                }
                return xhr;
            }

            this.setDebug = function(flag) {
                debugFlag = flag;
                console.log('>>> set debugFlag : ' + debugFlag);
            }
            this.setXhrTimeout = function(timeout) {
                xhrTimeout = timeout;
            }
            this.setCollectorUrl = function(url) {
                collectorUrl = stringEndsWith(url, '/') ? url : url + '/';
            }
            this.setApiKey = function(key) {
                apiKey = key;
            }
            this.setCustomerId = function(id) {
                customerId = id;
            }
            this.setDomainId = function(id) {
                domainId = id;
            }
            this.setUserId = function(id) {
                userId = id;
            }
            this.setVisitorCookieTimeout = function(millis) {
                confVisitorCookieTimeout = millis;
            }
            this.setSessionTimeout = function(millis) {
                confSessionCookieTimeout = millis;
            }
            this.setIgnoreActionTime = function(millis) {
                confIgnoreActionTime = millis;
            }
            this.printVariables = function() {
                var msg = 'not initialized';
                msg = (collectorUrl ? '>>> collectorUrl : ' + collectorUrl : '')
                    + (apiKey ? '\n>>> apiKey       : ' + apiKey : '')
                    + (customerId ? '\n>>> customerId   : ' + customerId : '')
                    + (domainId ? '\n>>> domainId     : ' + domainId : '')
                    + (userId ? '\n>>> userId       : ' + userId : '');
                console.log(msg);
            }
            this.assignEventHandlerOnload = function() {
                if (documentAlias.readyState === 'complete') {
                    handleOnLoadEvent();}
                if (documentAlias.addEventListener) {
                    documentAlias.addEventListener('DOMContentLoaded', handleOnLoadEvent())
                } else if (windowAlias.addEventListener) {
                    windowAlias.addEventListener('load', handleOnLoadEvent, false);
                } else if (windowAlias.attachEvent) {
                    windowAlias.attachEvent('onload', handleOnLoadEvent);
                }
            }
            this.assignEventHandlerOnError = function() {                
                if (windowAlias.addEventListener) {
                    windowAlias.addEventListener('error', handleOnErrorEvent, false);
                } else if (windowAlias.attachEvent) {
                    windowAlias.attachEvent('onerror', handleOnErrorEvent);
                }
            }
            documentAlias.addEventListener('visibilitychange', function(){
                handleOnActionEvent(collectorUrl + 'defaultData');
            });
            // 초기에 페이지가 로드될 때 A 태그 클릭 이벤트 리스너를 추가합니다.
            function addClickListenersToLinks(links) {
                links.forEach(function(link) {
                    link.addEventListener('click', function(e) {
                        // 클릭 이벤트가 발생하면 해당 A 태그에 대한 데이터를 전송합니다.
                        aTagClickEvent(link);
                    });
                });
            }
            const links = document.querySelectorAll('a');
            addClickListenersToLinks(links);
            // MutationObserver 생성
            const observer = new MutationObserver(function(mutationsList) {
                mutationsList.forEach(function(mutation) {
                    if (mutation.addedNodes.length) {
                        const addedLinks = mutation.addedNodes;
                        addedLinks.forEach(function(addedLink) {
                            //addedLink = addedLink.tagName === 'A' ? addedLink : addedLink.querySelector('a');
                            if (addedLink.tagName === 'a') {
                                addedLink.addEventListener('click', function(e) {
                                // 클릭 이벤트가 발생하면 해당 A 태그에 대한 데이터를 전송합니다.
                                aTagClickEvent(addedLink);
                                });
                            }
                        });
                    }
                });
            });
            // MutationObserver 시작
            window.addEventListener('load', function() {
                setTimeout(function() {
                    // 페이지가 로드되면 MutationObserver를 시작합니다.
                    observer.observe(document.body, { childList: true, subtree: true });
                }, 100);
            });
            function aTagClickEvent(link) {
                try {
                    var linkTitle = '';
                    var linkType = '';
                    var linkText = '';
                    var linkUrl = link.href;
                    if (typeof linkUrl === 'undefined') {
                        return;
                    }
                    if (link.innerText.trim().length > 1) {
                        linkText = link.innerText;
                    }
                    if (link.title.trim().length > 1) {
                        linkTitle = link.title;
                    }
                    if (link.children.length > 0) {
                        for (var j = 0; j < link.children.length; j++) {
                            var target = link.children[j];
                            if (target.children.length > 0) {
                                for (var k = 0; k < target.children.length; k++) {
                                    if (target.children[k].tagName === 'IMG' || target.children[k].tagName === 'img') {
                                        linkTitle = target.children[k].getAttribute('alt');
                                        break;
                                    }
                                }
                            } else if (typeof target.getAttribute('alt') !== 'undefined') {
                                linkTitle = target.getAttribute('alt');
                            }
                        }
                    }
                    if (link.title === '다운로드' || link.textContent.trim().length > 0) {
                        linkTitle = link.textContent;
                    }
                    if (linkUrl.match(/^https?:\/\//) && !linkUrl.includes(location.hostname)) {
                        linkType = 'ex';
                    } else if (link.download.length >= 1 || link.title === '다운로드' ||
                        linkTitle.match(configDownloadExtensions) || linkUrl.match(configDownloadExtensions) ||
                        linkText.match(configDownloadExtensions)) {
                        linkType = 'dl';
                    } else if (linkUrl.match(/^https?:\/\//) && linkUrl.includes(location.hostname)) { 
                        linkType = 'in';
                    } else {
                        linkType = 'un';
                    }
                    linkUrl = linkUrl ? linkUrl.trim() : '';
                    linkType = linkType ? linkType.trim() : '';
                    linkText = linkText ? linkText.trim() : '';
                    linkTitle = linkTitle ? linkTitle.trim() : '';
                    const linkData = {
                        lu: linkUrl,
                        lt: linkType,
                        lx: linkText,
                        lte: linkTitle
                    };
                    sendRequest(collectorUrl + 'defaultData', linkData);
                } catch (e) {
                    console.log('click event error');
                }
            }

            function skwAddClickListener(selectorsAndInputIds) {
                selectorsAndInputIds.forEach(function(selectorAndInputId) {
                    var selector = selectorAndInputId[0];
                    var inputId = selectorAndInputId[1];
                    var button = document.querySelector(selector);
            
                    if (button) {
                        button.addEventListener('click', function(e) {
                            var searchKeyword = document.getElementById(inputId).value;
                            sendRequest(collectorUrl + 'defaultData', searchKeyword);
                        });
                    }
                });
            }
            var skwInput = [
                ['#totSearch', 'pQuery_tmp'], // 청년몽땅메인검색
                ['.se-btn1.searchBtn', 'polyBizSjnm'], // 청년몽땅맞춤검색
                ['.btn_sch', 'sv'], // 청년몽땅일반검색
                ['#search-btn', 'sv'], // 청년몽땅공고검색
                ['.btn.t_sch.cfocus', 'resResearcher'], // 청년몽땅공고검색
                ['#listForm > div.csec_bot.clearfix > div.rt > a:nth-child(2)', 'searchKeyword'], // 청년몽땅지원정보검색
                ['.btn_ts', 'pQuery_tmp'] // 청년몽땅검색엔진API
            ];
            skwInput.push(_skwInput);
            // 선택자와 입력 요소 ID의 배열
            // 함수 호출
            skwAddClickListener(skwInput);
            
        }
        function startTracking() {
            var tracker = new Tracker();
            // call method system assigned before user's
            for (var i=0; i<preProc.length; i++) {
                if (preProc[i]) {
                    preProc[i].unshift(tracker);
                    apply(preProc[i]);
                }
            }
            // method user assigned
            for (var i=0; i<_bwa.length; i++) {
                if (_bwa[i]) {
                    _bwa[i].unshift(tracker);
                    apply(_bwa[i]);
                }
            }
            // call method system assigned after user's
            for (var i=0; i<postProc.length; i++) {
                if (postProc[i]) {
                    postProc[i].unshift(tracker);
                    apply(postProc[i]);
                }
            } 
        }  
 
        BWA = {
            start: function () {
                startTracking(); 
            },
            trigger: function (event, params, context) {
                if (!eventHandlers[event]) {
                    return;
                }
                for (var i=0; eventHandlers[event][i].length; i++) {
                    eventHandlers[event][i].apply(context || windowAlias, params);
                }
            }
        };

        if (typeof define === 'function' && define.amd) {
            define('bwa', [], function() { return BWA; });
        }
        return BWA;
    }());    
}


(function () {
    // Logic is not executed on registered URLs
    function isExcludeUrl(_excludeUrls) {
        return _excludeUrls.some(function(url) {
            return window.location.toString().indexOf(url) !== -1;
        });
    }
    
    if (isExcludeUrl(_excludeUrls)) {
        return false;
    }

    function hasBwaConfiguration() {
        if ('object' !== typeof _bwa) {
            return false;
        }
        var lengthType = typeof _bwa.length;
        if ('undefined' === lengthType) {
            return false;
        }
        return !!_bwa.length;
    }
    if (hasBwaConfiguration()) {
        window._BWA.start();
    } else {
        console.error('_bwa is not set!!!');
    }
}());