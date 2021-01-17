
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var dateformat = createCommonjsModule(function (module, exports) {
    function _typeof(obj){"@babel/helpers - typeof";if(typeof Symbol==="function"&&typeof Symbol.iterator==="symbol"){_typeof=function _typeof(obj){return typeof obj};}else {_typeof=function _typeof(obj){return obj&&typeof Symbol==="function"&&obj.constructor===Symbol&&obj!==Symbol.prototype?"symbol":typeof obj};}return _typeof(obj)}(function(global){var _arguments=arguments;var dateFormat=function(){var token=/d{1,4}|D{3,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LlopSZWN]|"[^"]*"|'[^']*'/g;var timezone=/\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g;var timezoneClip=/[^-+\dA-Z]/g;return function(date,mask,utc,gmt){if(_arguments.length===1&&kindOf(date)==="string"&&!/\d/.test(date)){mask=date;date=undefined;}date=date||date===0?date:new Date;if(!(date instanceof Date)){date=new Date(date);}if(isNaN(date)){throw TypeError("Invalid date")}mask=String(dateFormat.masks[mask]||mask||dateFormat.masks["default"]);var maskSlice=mask.slice(0,4);if(maskSlice==="UTC:"||maskSlice==="GMT:"){mask=mask.slice(4);utc=true;if(maskSlice==="GMT:"){gmt=true;}}var _=function _(){return utc?"getUTC":"get"};var _d=function d(){return date[_()+"Date"]()};var D=function D(){return date[_()+"Day"]()};var _m=function m(){return date[_()+"Month"]()};var y=function y(){return date[_()+"FullYear"]()};var _H=function H(){return date[_()+"Hours"]()};var _M=function M(){return date[_()+"Minutes"]()};var _s=function s(){return date[_()+"Seconds"]()};var _L=function L(){return date[_()+"Milliseconds"]()};var _o=function o(){return utc?0:date.getTimezoneOffset()};var _W=function W(){return getWeek(date)};var _N=function N(){return getDayOfWeek(date)};var flags={d:function d(){return _d()},dd:function dd(){return pad(_d())},ddd:function ddd(){return dateFormat.i18n.dayNames[D()]},DDD:function DDD(){return getDayName({y:y(),m:_m(),D:D(),_:_(),dayName:dateFormat.i18n.dayNames[D()],short:true})},dddd:function dddd(){return dateFormat.i18n.dayNames[D()+7]},DDDD:function DDDD(){return getDayName({y:y(),m:_m(),D:D(),_:_(),dayName:dateFormat.i18n.dayNames[D()+7]})},m:function m(){return _m()+1},mm:function mm(){return pad(_m()+1)},mmm:function mmm(){return dateFormat.i18n.monthNames[_m()]},mmmm:function mmmm(){return dateFormat.i18n.monthNames[_m()+12]},yy:function yy(){return String(y()).slice(2)},yyyy:function yyyy(){return pad(y(),4)},h:function h(){return _H()%12||12},hh:function hh(){return pad(_H()%12||12)},H:function H(){return _H()},HH:function HH(){return pad(_H())},M:function M(){return _M()},MM:function MM(){return pad(_M())},s:function s(){return _s()},ss:function ss(){return pad(_s())},l:function l(){return pad(_L(),3)},L:function L(){return pad(Math.floor(_L()/10))},t:function t(){return _H()<12?dateFormat.i18n.timeNames[0]:dateFormat.i18n.timeNames[1]},tt:function tt(){return _H()<12?dateFormat.i18n.timeNames[2]:dateFormat.i18n.timeNames[3]},T:function T(){return _H()<12?dateFormat.i18n.timeNames[4]:dateFormat.i18n.timeNames[5]},TT:function TT(){return _H()<12?dateFormat.i18n.timeNames[6]:dateFormat.i18n.timeNames[7]},Z:function Z(){return gmt?"GMT":utc?"UTC":(String(date).match(timezone)||[""]).pop().replace(timezoneClip,"").replace(/GMT\+0000/g,"UTC")},o:function o(){return (_o()>0?"-":"+")+pad(Math.floor(Math.abs(_o())/60)*100+Math.abs(_o())%60,4)},p:function p(){return (_o()>0?"-":"+")+pad(Math.floor(Math.abs(_o())/60),2)+":"+pad(Math.floor(Math.abs(_o())%60),2)},S:function S(){return ["th","st","nd","rd"][_d()%10>3?0:(_d()%100-_d()%10!=10)*_d()%10]},W:function W(){return _W()},N:function N(){return _N()}};return mask.replace(token,function(match){if(match in flags){return flags[match]()}return match.slice(1,match.length-1)})}}();dateFormat.masks={default:"ddd mmm dd yyyy HH:MM:ss",shortDate:"m/d/yy",paddedShortDate:"mm/dd/yyyy",mediumDate:"mmm d, yyyy",longDate:"mmmm d, yyyy",fullDate:"dddd, mmmm d, yyyy",shortTime:"h:MM TT",mediumTime:"h:MM:ss TT",longTime:"h:MM:ss TT Z",isoDate:"yyyy-mm-dd",isoTime:"HH:MM:ss",isoDateTime:"yyyy-mm-dd'T'HH:MM:sso",isoUtcDateTime:"UTC:yyyy-mm-dd'T'HH:MM:ss'Z'",expiresHeaderFormat:"ddd, dd mmm yyyy HH:MM:ss Z"};dateFormat.i18n={dayNames:["Sun","Mon","Tue","Wed","Thu","Fri","Sat","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],monthNames:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","January","February","March","April","May","June","July","August","September","October","November","December"],timeNames:["a","p","am","pm","A","P","AM","PM"]};var pad=function pad(val,len){val=String(val);len=len||2;while(val.length<len){val="0"+val;}return val};var getDayName=function getDayName(_ref){var y=_ref.y,m=_ref.m,D=_ref.D,_=_ref._,dayName=_ref.dayName,_ref$short=_ref["short"],_short=_ref$short===void 0?false:_ref$short;var today=new Date;var yesterday=new Date;yesterday.setDate(yesterday[_+"Date"]()-1);var tomorrow=new Date;tomorrow.setDate(tomorrow[_+"Date"]()+1);var today_D=function today_D(){return today[_+"Day"]()};var today_m=function today_m(){return today[_+"Month"]()};var today_y=function today_y(){return today[_+"FullYear"]()};var yesterday_D=function yesterday_D(){return yesterday[_+"Day"]()};var yesterday_m=function yesterday_m(){return yesterday[_+"Month"]()};var yesterday_y=function yesterday_y(){return yesterday[_+"FullYear"]()};var tomorrow_D=function tomorrow_D(){return tomorrow[_+"Day"]()};var tomorrow_m=function tomorrow_m(){return tomorrow[_+"Month"]()};var tomorrow_y=function tomorrow_y(){return tomorrow[_+"FullYear"]()};if(today_y()===y&&today_m()===m&&today_D()===D){return _short?"Tdy":"Today"}else if(yesterday_y()===y&&yesterday_m()===m&&yesterday_D()===D){return _short?"Ysd":"Yesterday"}else if(tomorrow_y()===y&&tomorrow_m()===m&&tomorrow_D()===D){return _short?"Tmw":"Tomorrow"}return dayName};var getWeek=function getWeek(date){var targetThursday=new Date(date.getFullYear(),date.getMonth(),date.getDate());targetThursday.setDate(targetThursday.getDate()-(targetThursday.getDay()+6)%7+3);var firstThursday=new Date(targetThursday.getFullYear(),0,4);firstThursday.setDate(firstThursday.getDate()-(firstThursday.getDay()+6)%7+3);var ds=targetThursday.getTimezoneOffset()-firstThursday.getTimezoneOffset();targetThursday.setHours(targetThursday.getHours()-ds);var weekDiff=(targetThursday-firstThursday)/(864e5*7);return 1+Math.floor(weekDiff)};var getDayOfWeek=function getDayOfWeek(date){var dow=date.getDay();if(dow===0){dow=7;}return dow};var kindOf=function kindOf(val){if(val===null){return "null"}if(val===undefined){return "undefined"}if(_typeof(val)!=="object"){return _typeof(val)}if(Array.isArray(val)){return "array"}return {}.toString.call(val).slice(8,-1).toLowerCase()};if((_typeof(exports))==="object"){module.exports=dateFormat;}else {global.dateFormat=dateFormat;}})(void 0);
    });

    async function loadWeb3 () {
        // window.Web3 = Web3
        if (window.ethereum) {
            window.web3 = new window.Web3(window.ethereum);
            // await window.ethereum.enable()
        }
        else if (window.web3) {
            window.web3 = new window.Web3(window.web3.currentProvider);
        }
        else {
            window.alert("Non-Ethereum browser detected. You should consider trying MetaMask!");
        }
        return window.web3;
    }

    const constants = {
        dateFormatStr: "dddd, mmmm dS, yyyy, h:MM:ss TT"
    };

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    var contractName = "EvieCoin";
    var abi = [
    	{
    		inputs: [
    			{
    				internalType: "uint256",
    				name: "initialSupply",
    				type: "uint256"
    			}
    		],
    		stateMutability: "nonpayable",
    		type: "constructor"
    	},
    	{
    		anonymous: false,
    		inputs: [
    			{
    				indexed: true,
    				internalType: "address",
    				name: "owner",
    				type: "address"
    			},
    			{
    				indexed: true,
    				internalType: "address",
    				name: "spender",
    				type: "address"
    			},
    			{
    				indexed: false,
    				internalType: "uint256",
    				name: "value",
    				type: "uint256"
    			}
    		],
    		name: "Approval",
    		type: "event"
    	},
    	{
    		anonymous: false,
    		inputs: [
    			{
    				indexed: false,
    				internalType: "address",
    				name: "user",
    				type: "address"
    			},
    			{
    				indexed: false,
    				internalType: "uint256",
    				name: "timestamp",
    				type: "uint256"
    			}
    		],
    		name: "ClockInTimeEvent",
    		type: "event"
    	},
    	{
    		anonymous: false,
    		inputs: [
    			{
    				indexed: false,
    				internalType: "address",
    				name: "user",
    				type: "address"
    			},
    			{
    				indexed: false,
    				internalType: "uint256",
    				name: "timestamp",
    				type: "uint256"
    			}
    		],
    		name: "ClockOutTimeEvent",
    		type: "event"
    	},
    	{
    		anonymous: false,
    		inputs: [
    			{
    				indexed: true,
    				internalType: "address",
    				name: "previousOwner",
    				type: "address"
    			},
    			{
    				indexed: true,
    				internalType: "address",
    				name: "newOwner",
    				type: "address"
    			}
    		],
    		name: "OwnershipTransferred",
    		type: "event"
    	},
    	{
    		anonymous: false,
    		inputs: [
    			{
    				indexed: false,
    				internalType: "address",
    				name: "_to",
    				type: "address"
    			},
    			{
    				indexed: false,
    				internalType: "uint256",
    				name: "value",
    				type: "uint256"
    			}
    		],
    		name: "PayoutMadeEvent",
    		type: "event"
    	},
    	{
    		anonymous: false,
    		inputs: [
    			{
    				indexed: true,
    				internalType: "address",
    				name: "from",
    				type: "address"
    			},
    			{
    				indexed: true,
    				internalType: "address",
    				name: "to",
    				type: "address"
    			},
    			{
    				indexed: false,
    				internalType: "uint256",
    				name: "value",
    				type: "uint256"
    			}
    		],
    		name: "Transfer",
    		type: "event"
    	},
    	{
    		inputs: [
    			{
    				internalType: "address",
    				name: "owner",
    				type: "address"
    			},
    			{
    				internalType: "address",
    				name: "spender",
    				type: "address"
    			}
    		],
    		name: "allowance",
    		outputs: [
    			{
    				internalType: "uint256",
    				name: "",
    				type: "uint256"
    			}
    		],
    		stateMutability: "view",
    		type: "function",
    		constant: true
    	},
    	{
    		inputs: [
    			{
    				internalType: "address",
    				name: "spender",
    				type: "address"
    			},
    			{
    				internalType: "uint256",
    				name: "amount",
    				type: "uint256"
    			}
    		],
    		name: "approve",
    		outputs: [
    			{
    				internalType: "bool",
    				name: "",
    				type: "bool"
    			}
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    			{
    				internalType: "address",
    				name: "account",
    				type: "address"
    			}
    		],
    		name: "balanceOf",
    		outputs: [
    			{
    				internalType: "uint256",
    				name: "",
    				type: "uint256"
    			}
    		],
    		stateMutability: "view",
    		type: "function",
    		constant: true
    	},
    	{
    		inputs: [
    		],
    		name: "decimals",
    		outputs: [
    			{
    				internalType: "uint8",
    				name: "",
    				type: "uint8"
    			}
    		],
    		stateMutability: "view",
    		type: "function",
    		constant: true
    	},
    	{
    		inputs: [
    			{
    				internalType: "address",
    				name: "spender",
    				type: "address"
    			},
    			{
    				internalType: "uint256",
    				name: "subtractedValue",
    				type: "uint256"
    			}
    		],
    		name: "decreaseAllowance",
    		outputs: [
    			{
    				internalType: "bool",
    				name: "",
    				type: "bool"
    			}
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    			{
    				internalType: "address",
    				name: "spender",
    				type: "address"
    			},
    			{
    				internalType: "uint256",
    				name: "addedValue",
    				type: "uint256"
    			}
    		],
    		name: "increaseAllowance",
    		outputs: [
    			{
    				internalType: "bool",
    				name: "",
    				type: "bool"
    			}
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    		],
    		name: "name",
    		outputs: [
    			{
    				internalType: "string",
    				name: "",
    				type: "string"
    			}
    		],
    		stateMutability: "view",
    		type: "function",
    		constant: true
    	},
    	{
    		inputs: [
    		],
    		name: "owner",
    		outputs: [
    			{
    				internalType: "address",
    				name: "",
    				type: "address"
    			}
    		],
    		stateMutability: "view",
    		type: "function",
    		constant: true
    	},
    	{
    		inputs: [
    		],
    		name: "renounceOwnership",
    		outputs: [
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    		],
    		name: "symbol",
    		outputs: [
    			{
    				internalType: "string",
    				name: "",
    				type: "string"
    			}
    		],
    		stateMutability: "view",
    		type: "function",
    		constant: true
    	},
    	{
    		inputs: [
    		],
    		name: "totalSupply",
    		outputs: [
    			{
    				internalType: "uint256",
    				name: "",
    				type: "uint256"
    			}
    		],
    		stateMutability: "view",
    		type: "function",
    		constant: true
    	},
    	{
    		inputs: [
    			{
    				internalType: "address",
    				name: "recipient",
    				type: "address"
    			},
    			{
    				internalType: "uint256",
    				name: "amount",
    				type: "uint256"
    			}
    		],
    		name: "transfer",
    		outputs: [
    			{
    				internalType: "bool",
    				name: "",
    				type: "bool"
    			}
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    			{
    				internalType: "address",
    				name: "sender",
    				type: "address"
    			},
    			{
    				internalType: "address",
    				name: "recipient",
    				type: "address"
    			},
    			{
    				internalType: "uint256",
    				name: "amount",
    				type: "uint256"
    			}
    		],
    		name: "transferFrom",
    		outputs: [
    			{
    				internalType: "bool",
    				name: "",
    				type: "bool"
    			}
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    			{
    				internalType: "address",
    				name: "newOwner",
    				type: "address"
    			}
    		],
    		name: "transferOwnership",
    		outputs: [
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    		],
    		name: "clockStartTime",
    		outputs: [
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    		],
    		name: "clockEndTime",
    		outputs: [
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	},
    	{
    		inputs: [
    			{
    				internalType: "uint256",
    				name: "amount",
    				type: "uint256"
    			}
    		],
    		name: "mint_new",
    		outputs: [
    		],
    		stateMutability: "nonpayable",
    		type: "function"
    	}
    ];
    var metadata = "{\"compiler\":{\"version\":\"0.7.0+commit.9e61f92b\"},\"language\":\"Solidity\",\"output\":{\"abi\":[{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"initialSupply\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"spender\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"Approval\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"address\",\"name\":\"user\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"timestamp\",\"type\":\"uint256\"}],\"name\":\"ClockInTimeEvent\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"address\",\"name\":\"user\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"timestamp\",\"type\":\"uint256\"}],\"name\":\"ClockOutTimeEvent\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"previousOwner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"OwnershipTransferred\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"address\",\"name\":\"_to\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"PayoutMadeEvent\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"from\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"to\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"Transfer\",\"type\":\"event\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"owner\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"spender\",\"type\":\"address\"}],\"name\":\"allowance\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"spender\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"approve\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"}],\"name\":\"balanceOf\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"clockEndTime\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"clockStartTime\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"decimals\",\"outputs\":[{\"internalType\":\"uint8\",\"name\":\"\",\"type\":\"uint8\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"spender\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"subtractedValue\",\"type\":\"uint256\"}],\"name\":\"decreaseAllowance\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"spender\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"addedValue\",\"type\":\"uint256\"}],\"name\":\"increaseAllowance\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"mint_new\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"name\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"renounceOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"symbol\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"totalSupply\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"recipient\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"transfer\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"recipient\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"transferFrom\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"transferOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}],\"devdoc\":{\"kind\":\"dev\",\"methods\":{\"allowance(address,address)\":{\"details\":\"See {IERC20-allowance}.\"},\"approve(address,uint256)\":{\"details\":\"See {IERC20-approve}. Requirements: - `spender` cannot be the zero address.\"},\"balanceOf(address)\":{\"details\":\"See {IERC20-balanceOf}.\"},\"clockStartTime()\":{\"details\":\"a user clocks in their start time\"},\"decimals()\":{\"details\":\"Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5,05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is called. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.\"},\"decreaseAllowance(address,uint256)\":{\"details\":\"Atomically decreases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address. - `spender` must have allowance for the caller of at least `subtractedValue`.\"},\"increaseAllowance(address,uint256)\":{\"details\":\"Atomically increases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address.\"},\"name()\":{\"details\":\"Returns the name of the token.\"},\"owner()\":{\"details\":\"Returns the address of the current owner.\"},\"renounceOwnership()\":{\"details\":\"Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.\"},\"symbol()\":{\"details\":\"Returns the symbol of the token, usually a shorter version of the name.\"},\"totalSupply()\":{\"details\":\"See {IERC20-totalSupply}.\"},\"transfer(address,uint256)\":{\"details\":\"See {IERC20-transfer}. Requirements: - `recipient` cannot be the zero address. - the caller must have a balance of at least `amount`.\"},\"transferFrom(address,address,uint256)\":{\"details\":\"See {IERC20-transferFrom}. Emits an {Approval} event indicating the updated allowance. This is not required by the EIP. See the note at the beginning of {ERC20}. Requirements: - `sender` and `recipient` cannot be the zero address. - `sender` must have a balance of at least `amount`. - the caller must have allowance for ``sender``'s tokens of at least `amount`.\"},\"transferOwnership(address)\":{\"details\":\"Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.\"}},\"stateVariables\":{\"clock_in_times\":{\"details\":\"the clock in time for an account on a given day\"},\"last_clock_in_day\":{\"details\":\"check the last clock out day for working. Used to ensure that only one clock out is done per day\"}},\"version\":1},\"userdoc\":{\"kind\":\"user\",\"methods\":{},\"version\":1}},\"settings\":{\"compilationTarget\":{\"/home/lev/code/blockchain/eth/evie-timer/contracts/EvieCoin.sol\":\"EvieCoin\"},\"evmVersion\":\"istanbul\",\"libraries\":{},\"metadata\":{\"bytecodeHash\":\"ipfs\"},\"optimizer\":{\"enabled\":false,\"runs\":200},\"remappings\":[]},\"sources\":{\"/home/lev/code/blockchain/eth/evie-timer/contracts/EvieCoin.sol\":{\"keccak256\":\"0xaa7910ebba9248e6ffc1c60613f94898a865033b1dfff4349e1ca3b01904a529\",\"urls\":[\"bzz-raw://7d5edbeb57f7a3ae18190d9126db799dad3f2d3efdbee49aa146d7355f01e98f\",\"dweb:/ipfs/QmWQPRDUZxSz5g1udyPqh1TarS6Uo2taJzYadtfutx5W15\"]},\"@openzeppelin/contracts/GSN/Context.sol\":{\"keccak256\":\"0x8d3cb350f04ff49cfb10aef08d87f19dcbaecc8027b0bed12f3275cd12f38cf0\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://ded47ec7c96750f9bd04bbbc84f659992d4ba901cb7b532a52cd468272cf378f\",\"dweb:/ipfs/QmfBrGtQP7rZEqEg6Wz6jh2N2Kukpj1z5v3CGWmAqrzm96\"]},\"@openzeppelin/contracts/access/Ownable.sol\":{\"keccak256\":\"0xf7c39c7e6d06ed3bda90cfefbcbf2ddc32c599c3d6721746546ad64946efccaa\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://cb57a28e189cd8b05748db44bdd51d608e6f1364dd1b35ad921e1bc82c10631e\",\"dweb:/ipfs/QmaWWTBbVu2pRR9XUbE4iC159NoP59cRF9ZJwhf4ghFN9i\"]},\"@openzeppelin/contracts/math/SafeMath.sol\":{\"keccak256\":\"0x3b21f2c8d626de3b9925ae33e972d8bf5c8b1bffb3f4ee94daeed7d0679036e6\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://7f8d45329fecbf0836ad7543330c3ecd0f8d0ffa42d4016278c3eb2215fdcdfe\",\"dweb:/ipfs/QmXWLT7GcnHtA5NiD6MFi2CV3EWJY4wv5mLNnypqYDrxL3\"]},\"@openzeppelin/contracts/token/ERC20/ERC20.sol\":{\"keccak256\":\"0xcbd85c86627a47fd939f1f4ee3ba626575ff2a182e1804b29f5136394449b538\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://53c6a80c519bb9356aad28efa9a1ec31603860eb759d2dc57f545fcae1dd1aca\",\"dweb:/ipfs/QmfRS6TtMNUHhvgLHXK21qKNnpn2S7g2Yd1fKaHKyFiJsR\"]},\"@openzeppelin/contracts/token/ERC20/IERC20.sol\":{\"keccak256\":\"0x5f02220344881ce43204ae4a6281145a67bc52c2bb1290a791857df3d19d78f5\",\"license\":\"MIT\",\"urls\":[\"bzz-raw://24427744bd3e6cb73c17010119af12a318289c0253a4d9acb8576c9fb3797b08\",\"dweb:/ipfs/QmTLDqpKRBuxGxRAmjgXt9AkXyACW3MtKzi7PYjm5iMfGC\"]}},\"version\":1}";
    var bytecode = "0x60806040523480156200001157600080fd5b50604051620024b5380380620024b5833981810160405260208110156200003757600080fd5b81019080805190602001909291905050506040518060400160405280600881526020017f45766965434f494e0000000000000000000000000000000000000000000000008152506040518060400160405280600381526020017f45564500000000000000000000000000000000000000000000000000000000008152508160039080519060200190620000cc9291906200069c565b508060049080519060200190620000e59291906200069c565b506012600560006101000a81548160ff021916908360ff1602179055505050600062000116620001f660201b60201c565b905080600560016101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508073ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a350620001c633620001fe60201b60201c565b620001ef33620001db6200041960201b60201c565b60ff16600a0a83026200043060201b60201c565b5062000742565b600033905090565b6200020e620001f660201b60201c565b73ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614620002d1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260208152602001807f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657281525060200191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16141562000359576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260268152602001806200248f6026913960400191505060405180910390fd5b8073ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a380600560016101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b6000600560009054906101000a900460ff16905090565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff161415620004d4576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601f8152602001807f45524332303a206d696e7420746f20746865207a65726f20616464726573730081525060200191505060405180910390fd5b620004e8600083836200060e60201b60201c565b62000504816002546200061360201b620012471790919060201c565b60028190555062000562816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546200061360201b620012471790919060201c565b6000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a35050565b505050565b60008082840190508381101562000692576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10620006df57805160ff191683800117855562000710565b8280016001018555821562000710579182015b828111156200070f578251825591602001919060010190620006f2565b5b5090506200071f919062000723565b5090565b5b808211156200073e57600081600090555060010162000724565b5090565b611d3d80620007526000396000f3fe608060405234801561001057600080fd5b506004361061010b5760003560e01c8063715018a6116100a2578063a481aada11610071578063a481aada146104c9578063a9059cbb146104d3578063b939df5914610537578063dd62ed3e14610541578063f2fde38b146105b95761010b565b8063715018a6146103a45780638da5cb5b146103ae57806395d89b41146103e2578063a457c2d7146104655761010b565b8063313ce567116100de578063313ce5671461029957806339509351146102ba5780635a9ece241461031e57806370a082311461034c5761010b565b806306fdde0314610110578063095ea7b31461019357806318160ddd146101f757806323b872dd14610215575b600080fd5b6101186105fd565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561015857808201518184015260208101905061013d565b50505050905090810190601f1680156101855780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6101df600480360360408110156101a957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019092919050505061069f565b60405180821515815260200191505060405180910390f35b6101ff6106bd565b6040518082815260200191505060405180910390f35b6102816004803603606081101561022b57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506106c7565b60405180821515815260200191505060405180910390f35b6102a16107a0565b604051808260ff16815260200191505060405180910390f35b610306600480360360408110156102d057600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506107b7565b60405180821515815260200191505060405180910390f35b61034a6004803603602081101561033457600080fd5b810190808035906020019092919050505061086a565b005b61038e6004803603602081101561036257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610948565b6040518082815260200191505060405180910390f35b6103ac610990565b005b6103b6610b1b565b604051808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b6103ea610b45565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561042a57808201518184015260208101905061040f565b50505050905090810190601f1680156104575780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6104b16004803603604081101561047b57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610be7565b60405180821515815260200191505060405180910390f35b6104d1610cb4565b005b61051f600480360360408110156104e957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610e74565b60405180821515815260200191505060405180910390f35b61053f610e92565b005b6105a36004803603604081101561055757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610fb0565b6040518082815260200191505060405180910390f35b6105fb600480360360208110156105cf57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050611037565b005b606060038054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156106955780601f1061066a57610100808354040283529160200191610695565b820191906000526020600020905b81548152906001019060200180831161067857829003601f168201915b5050505050905090565b60006106b36106ac6112cf565b84846112d7565b6001905092915050565b6000600254905090565b60006106d48484846114ce565b610795846106e06112cf565b61079085604051806060016040528060288152602001611c7260289139600160008b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006107466112cf565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461178f9092919063ffffffff16565b6112d7565b600190509392505050565b6000600560009054906101000a900460ff16905090565b60006108606107c46112cf565b8461085b85600160006107d56112cf565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461124790919063ffffffff16565b6112d7565b6001905092915050565b6108726112cf565b73ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614610934576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260208152602001807f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657281525060200191505060405180910390fd5b61094561093f610b1b565b8261184f565b50565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b6109986112cf565b73ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614610a5a576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260208152602001807f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657281525060200191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a36000600560016101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550565b6000600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b606060048054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610bdd5780601f10610bb257610100808354040283529160200191610bdd565b820191906000526020600020905b815481529060010190602001808311610bc057829003601f168201915b5050505050905090565b6000610caa610bf46112cf565b84610ca585604051806060016040528060258152602001611ce36025913960016000610c1e6112cf565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008a73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461178f9092919063ffffffff16565b6112d7565b6001905092915050565b600760003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900461ffff1661ffff16610d1c6201518042611a1690919063ffffffff16565b61ffff1611610d2a57600080fd5b42600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610d846201518042611a1690919063ffffffff16565b600760003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548161ffff021916908361ffff160217905550600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020507fd43639c22edfa44378754c6d9b9b75b749d1512256727b73d99ba6f758ad28173342604051808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019250505060405180910390a1565b6000610e88610e816112cf565b84846114ce565b6001905092915050565b6000429050600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054811015610ee357600080fd5b610e10610f38600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205483611a6090919063ffffffff16565b11610f5857610f5733610f496107a0565b60ff16600a0a600102611aaa565b5b7fd43639c22edfa44378754c6d9b9b75b749d1512256727b73d99ba6f758ad28173342604051808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019250505060405180910390a150565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b61103f6112cf565b73ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614611101576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260208152602001807f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657281525060200191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161415611187576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526026815260200180611c046026913960400191505060405180910390fd5b8073ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a380600560016101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b6000808284019050838110156112c5576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b600033905090565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16141561135d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526024815260200180611cbf6024913960400191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156113e3576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526022815260200180611c2a6022913960400191505060405180910390fd5b80600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925836040518082815260200191505060405180910390a3505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415611554576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526025815260200180611c9a6025913960400191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156115da576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526023815260200180611be16023913960400191505060405180910390fd5b6115e5838383611b15565b61165081604051806060016040528060268152602001611c4c602691396000808773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461178f9092919063ffffffff16565b6000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506116e3816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461124790919063ffffffff16565b6000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a3505050565b600083831115829061183c576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b838110156118015780820151818401526020810190506117e6565b50505050905090810190601f16801561182e5780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b5060008385039050809150509392505050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156118f2576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601f8152602001807f45524332303a206d696e7420746f20746865207a65726f20616464726573730081525060200191505060405180910390fd5b6118fe60008383611b15565b6119138160025461124790919063ffffffff16565b60028190555061196a816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461124790919063ffffffff16565b6000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a35050565b6000611a5883836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f000000000000815250611b1a565b905092915050565b6000611aa283836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f77000081525061178f565b905092915050565b611abc611ab5610b1b565b83836114ce565b7f206f9d86997f19b3edba08c74d5d6c53f9b51edccccfbc4b826afe94403e85948282604051808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019250505060405180910390a15050565b505050565b60008083118290611bc6576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b83811015611b8b578082015181840152602081019050611b70565b50505050905090810190601f168015611bb85780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b506000838581611bd257fe5b04905080915050939250505056fe45524332303a207472616e7366657220746f20746865207a65726f20616464726573734f776e61626c653a206e6577206f776e657220697320746865207a65726f206164647265737345524332303a20617070726f766520746f20746865207a65726f206164647265737345524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e636545524332303a207472616e7366657220616d6f756e74206578636565647320616c6c6f77616e636545524332303a207472616e736665722066726f6d20746865207a65726f206164647265737345524332303a20617070726f76652066726f6d20746865207a65726f206164647265737345524332303a2064656372656173656420616c6c6f77616e63652062656c6f77207a65726fa2646970667358221220d993511e593f56e66d3af776eec3df1a9bde4c47daefffb6dfd0957b21c9c5a664736f6c634300070000334f776e61626c653a206e6577206f776e657220697320746865207a65726f2061646472657373";
    var deployedBytecode = "0x608060405234801561001057600080fd5b506004361061010b5760003560e01c8063715018a6116100a2578063a481aada11610071578063a481aada146104c9578063a9059cbb146104d3578063b939df5914610537578063dd62ed3e14610541578063f2fde38b146105b95761010b565b8063715018a6146103a45780638da5cb5b146103ae57806395d89b41146103e2578063a457c2d7146104655761010b565b8063313ce567116100de578063313ce5671461029957806339509351146102ba5780635a9ece241461031e57806370a082311461034c5761010b565b806306fdde0314610110578063095ea7b31461019357806318160ddd146101f757806323b872dd14610215575b600080fd5b6101186105fd565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561015857808201518184015260208101905061013d565b50505050905090810190601f1680156101855780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6101df600480360360408110156101a957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019092919050505061069f565b60405180821515815260200191505060405180910390f35b6101ff6106bd565b6040518082815260200191505060405180910390f35b6102816004803603606081101561022b57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506106c7565b60405180821515815260200191505060405180910390f35b6102a16107a0565b604051808260ff16815260200191505060405180910390f35b610306600480360360408110156102d057600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506107b7565b60405180821515815260200191505060405180910390f35b61034a6004803603602081101561033457600080fd5b810190808035906020019092919050505061086a565b005b61038e6004803603602081101561036257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610948565b6040518082815260200191505060405180910390f35b6103ac610990565b005b6103b6610b1b565b604051808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b6103ea610b45565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561042a57808201518184015260208101905061040f565b50505050905090810190601f1680156104575780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6104b16004803603604081101561047b57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610be7565b60405180821515815260200191505060405180910390f35b6104d1610cb4565b005b61051f600480360360408110156104e957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610e74565b60405180821515815260200191505060405180910390f35b61053f610e92565b005b6105a36004803603604081101561055757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610fb0565b6040518082815260200191505060405180910390f35b6105fb600480360360208110156105cf57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050611037565b005b606060038054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156106955780601f1061066a57610100808354040283529160200191610695565b820191906000526020600020905b81548152906001019060200180831161067857829003601f168201915b5050505050905090565b60006106b36106ac6112cf565b84846112d7565b6001905092915050565b6000600254905090565b60006106d48484846114ce565b610795846106e06112cf565b61079085604051806060016040528060288152602001611c7260289139600160008b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006107466112cf565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461178f9092919063ffffffff16565b6112d7565b600190509392505050565b6000600560009054906101000a900460ff16905090565b60006108606107c46112cf565b8461085b85600160006107d56112cf565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461124790919063ffffffff16565b6112d7565b6001905092915050565b6108726112cf565b73ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614610934576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260208152602001807f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657281525060200191505060405180910390fd5b61094561093f610b1b565b8261184f565b50565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b6109986112cf565b73ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614610a5a576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260208152602001807f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657281525060200191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a36000600560016101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550565b6000600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b606060048054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610bdd5780601f10610bb257610100808354040283529160200191610bdd565b820191906000526020600020905b815481529060010190602001808311610bc057829003601f168201915b5050505050905090565b6000610caa610bf46112cf565b84610ca585604051806060016040528060258152602001611ce36025913960016000610c1e6112cf565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008a73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461178f9092919063ffffffff16565b6112d7565b6001905092915050565b600760003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900461ffff1661ffff16610d1c6201518042611a1690919063ffffffff16565b61ffff1611610d2a57600080fd5b42600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610d846201518042611a1690919063ffffffff16565b600760003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548161ffff021916908361ffff160217905550600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020507fd43639c22edfa44378754c6d9b9b75b749d1512256727b73d99ba6f758ad28173342604051808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019250505060405180910390a1565b6000610e88610e816112cf565b84846114ce565b6001905092915050565b6000429050600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054811015610ee357600080fd5b610e10610f38600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205483611a6090919063ffffffff16565b11610f5857610f5733610f496107a0565b60ff16600a0a600102611aaa565b5b7fd43639c22edfa44378754c6d9b9b75b749d1512256727b73d99ba6f758ad28173342604051808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019250505060405180910390a150565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b61103f6112cf565b73ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614611101576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260208152602001807f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657281525060200191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161415611187576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526026815260200180611c046026913960400191505060405180910390fd5b8073ffffffffffffffffffffffffffffffffffffffff16600560019054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a380600560016101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b6000808284019050838110156112c5576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b600033905090565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16141561135d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526024815260200180611cbf6024913960400191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156113e3576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526022815260200180611c2a6022913960400191505060405180910390fd5b80600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925836040518082815260200191505060405180910390a3505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415611554576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526025815260200180611c9a6025913960400191505060405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156115da576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401808060200182810382526023815260200180611be16023913960400191505060405180910390fd5b6115e5838383611b15565b61165081604051806060016040528060268152602001611c4c602691396000808773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461178f9092919063ffffffff16565b6000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506116e3816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461124790919063ffffffff16565b6000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a3505050565b600083831115829061183c576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b838110156118015780820151818401526020810190506117e6565b50505050905090810190601f16801561182e5780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b5060008385039050809150509392505050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156118f2576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601f8152602001807f45524332303a206d696e7420746f20746865207a65726f20616464726573730081525060200191505060405180910390fd5b6118fe60008383611b15565b6119138160025461124790919063ffffffff16565b60028190555061196a816000808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461124790919063ffffffff16565b6000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a35050565b6000611a5883836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f000000000000815250611b1a565b905092915050565b6000611aa283836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f77000081525061178f565b905092915050565b611abc611ab5610b1b565b83836114ce565b7f206f9d86997f19b3edba08c74d5d6c53f9b51edccccfbc4b826afe94403e85948282604051808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020019250505060405180910390a15050565b505050565b60008083118290611bc6576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b83811015611b8b578082015181840152602081019050611b70565b50505050905090810190601f168015611bb85780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b506000838581611bd257fe5b04905080915050939250505056fe45524332303a207472616e7366657220746f20746865207a65726f20616464726573734f776e61626c653a206e6577206f776e657220697320746865207a65726f206164647265737345524332303a20617070726f766520746f20746865207a65726f206164647265737345524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e636545524332303a207472616e7366657220616d6f756e74206578636565647320616c6c6f77616e636545524332303a207472616e736665722066726f6d20746865207a65726f206164647265737345524332303a20617070726f76652066726f6d20746865207a65726f206164647265737345524332303a2064656372656173656420616c6c6f77616e63652062656c6f77207a65726fa2646970667358221220d993511e593f56e66d3af776eec3df1a9bde4c47daefffb6dfd0957b21c9c5a664736f6c63430007000033";
    var immutableReferences = {
    };
    var sourceMap = "314:1872:0:-:0;;;874:169;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1956:145:5;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2038:5;2030;:13;;;;;;;;;;;;:::i;:::-;;2063:7;2053;:17;;;;;;;;;;;;:::i;:::-;;2092:2;2080:9;;:14;;;;;;;;;;;;;;;;;;1956:145;;882:17:3;902:12;:10;;;:12;;:::i;:::-;882:32;;933:9;924:6;;:18;;;;;;;;;;;;;;;;;;990:9;957:43;;986:1;957:43;;;;;;;;;;;;848:159;944:29:0::1;962:10;944:17;;;:29;;:::i;:::-;983:53;989:10;1024;:8;;;:10;;:::i;:::-;1018:16;;:2;:16;1001:13;:34;983:5;;;:53;;:::i;:::-;874:169:::0;314:1872;;598:104:2;651:15;685:10;678:17;;598:104;:::o;2000:240:3:-;1297:12;:10;;;:12;;:::i;:::-;1287:22;;:6;;;;;;;;;;;:22;;;1279:67;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2108:1:::1;2088:22;;:8;:22;;;;2080:73;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2197:8;2168:38;;2189:6;;;;;;;;;;;2168:38;;;;;;;;;;;;2225:8;2216:6;;:17;;;;;;;;;;;;;;;;;;2000:240:::0;:::o;3068:81:5:-;3109:5;3133:9;;;;;;;;;;;3126:16;;3068:81;:::o;7790:370::-;7892:1;7873:21;;:7;:21;;;;7865:65;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;7941:49;7970:1;7974:7;7983:6;7941:20;;;:49;;:::i;:::-;8016:24;8033:6;8016:12;;:16;;;;;;:24;;;;:::i;:::-;8001:12;:39;;;;8071:30;8094:6;8071:9;:18;8081:7;8071:18;;;;;;;;;;;;;;;;:22;;;;;;:30;;;;:::i;:::-;8050:9;:18;8060:7;8050:18;;;;;;;;;;;;;;;:51;;;;8137:7;8116:37;;8133:1;8116:37;;;8146:6;8116:37;;;;;;;;;;;;;;;;;;7790:370;;:::o;10651:92::-;;;;:::o;882:176:4:-;940:7;959:9;975:1;971;:5;959:17;;999:1;994;:6;;986:46;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1050:1;1043:8;;;882:176;;;;:::o;314:1872:0:-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;";
    var deployedSourceMap = "314:1872:0:-:0;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2166:81:5;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;4202:166;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;3209:98;;;:::i;:::-;;;;;;;;;;;;;;;;;;;4835:317;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;3068:81;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;5547:215;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;1937:87:0;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;3365:117:5;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;1706:145:3;;;:::i;:::-;;1083:77;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;2360:85:5;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;6249:266;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;1232:281:0;;;:::i;:::-;;3685:172:5;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;;;1565:366:0;;;:::i;:::-;;3915:149:5;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;;;;;;;;;;;;;;;;;2000:240:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;2166:81:5;2203:13;2235:5;2228:12;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2166:81;:::o;4202:166::-;4285:4;4301:39;4310:12;:10;:12::i;:::-;4324:7;4333:6;4301:8;:39::i;:::-;4357:4;4350:11;;4202:166;;;;:::o;3209:98::-;3262:7;3288:12;;3281:19;;3209:98;:::o;4835:317::-;4941:4;4957:36;4967:6;4975:9;4986:6;4957:9;:36::i;:::-;5003:121;5012:6;5020:12;:10;:12::i;:::-;5034:89;5072:6;5034:89;;;;;;;;;;;;;;;;;:11;:19;5046:6;5034:19;;;;;;;;;;;;;;;:33;5054:12;:10;:12::i;:::-;5034:33;;;;;;;;;;;;;;;;:37;;:89;;;;;:::i;:::-;5003:8;:121::i;:::-;5141:4;5134:11;;4835:317;;;;;:::o;3068:81::-;3109:5;3133:9;;;;;;;;;;;3126:16;;3068:81;:::o;5547:215::-;5635:4;5651:83;5660:12;:10;:12::i;:::-;5674:7;5683:50;5722:10;5683:11;:25;5695:12;:10;:12::i;:::-;5683:25;;;;;;;;;;;;;;;:34;5709:7;5683:34;;;;;;;;;;;;;;;;:38;;:50;;;;:::i;:::-;5651:8;:83::i;:::-;5751:4;5744:11;;5547:215;;;;:::o;1937:87:0:-;1297:12:3;:10;:12::i;:::-;1287:22;;:6;;;;;;;;;;;:22;;;1279:67;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1995:22:0::1;2001:7;:5;:7::i;:::-;2010:6;1995:5;:22::i;:::-;1937:87:::0;:::o;3365:117:5:-;3431:7;3457:9;:18;3467:7;3457:18;;;;;;;;;;;;;;;;3450:25;;3365:117;;;:::o;1706:145:3:-;1297:12;:10;:12::i;:::-;1287:22;;:6;;;;;;;;;;;:22;;;1279:67;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1812:1:::1;1775:40;;1796:6;;;;;;;;;;;1775:40;;;;;;;;;;;;1842:1;1825:6;;:19;;;;;;;;;;;;;;;;;;1706:145::o:0;1083:77::-;1121:7;1147:6;;;;;;;;;;;1140:13;;1083:77;:::o;2360:85:5:-;2399:13;2431:7;2424:14;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2360:85;:::o;6249:266::-;6342:4;6358:129;6367:12;:10;:12::i;:::-;6381:7;6390:96;6429:15;6390:96;;;;;;;;;;;;;;;;;:11;:25;6402:12;:10;:12::i;:::-;6390:25;;;;;;;;;;;;;;;:34;6416:7;6390:34;;;;;;;;;;;;;;;;:38;;:96;;;;;:::i;:::-;6358:8;:129::i;:::-;6504:4;6497:11;;6249:266;;;;:::o;1232:281:0:-;1131:17;:29;1149:10;1131:29;;;;;;;;;;;;;;;;;;;;;;;;;1092:68;;1099:27;1119:6;1099:15;:19;;:27;;;;:::i;:::-;1092:68;;;1084:77;;;;;;1318:15:::1;1289:14;:26;1304:10;1289:26;;;;;;;;;;;;;;;:44;;;;1382:27;1402:6;1382:15;:19;;:27;;;;:::i;:::-;1343:17;:29;1361:10;1343:29;;;;;;;;;;;;;;;;:67;;;;;;;;;;;;;;;;;;1420:14;:26;1435:10;1420:26;;;;;;;;;;;;;;;::::0;1461:45:::1;1478:10;1490:15;1461:45;;;;;;;;;;;;;;;;;;;;;;;;;;1232:281::o:0;3685:172:5:-;3771:4;3787:42;3797:12;:10;:12::i;:::-;3811:9;3822:6;3787:9;:42::i;:::-;3846:4;3839:11;;3685:172;;;;:::o;1565:366:0:-;1606:13;1622:15;1606:31;;1667:14;:26;1682:10;1667:26;;;;;;;;;;;;;;;;1655:8;:38;;1647:47;;;;;;1752:7;1708:40;1721:14;:26;1736:10;1721:26;;;;;;;;;;;;;;;;1708:8;:12;;:40;;;;:::i;:::-;:51;1704:161;;1811:43;1819:10;1842;:8;:10::i;:::-;1836:16;;:2;:16;1831:1;:22;1811:7;:43::i;:::-;1704:161;1879:45;1896:10;1908:15;1879:45;;;;;;;;;;;;;;;;;;;;;;;;;;1565:366;:::o;3915:149:5:-;4004:7;4030:11;:18;4042:5;4030:18;;;;;;;;;;;;;;;:27;4049:7;4030:27;;;;;;;;;;;;;;;;4023:34;;3915:149;;;;:::o;2000:240:3:-;1297:12;:10;:12::i;:::-;1287:22;;:6;;;;;;;;;;;:22;;;1279:67;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2108:1:::1;2088:22;;:8;:22;;;;2080:73;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2197:8;2168:38;;2189:6;;;;;;;;;;;2168:38;;;;;;;;;;;;2225:8;2216:6;;:17;;;;;;;;;;;;;;;;;;2000:240:::0;:::o;882:176:4:-;940:7;959:9;975:1;971;:5;959:17;;999:1;994;:6;;986:46;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1050:1;1043:8;;;882:176;;;;:::o;598:104:2:-;651:15;685:10;678:17;;598:104;:::o;9313:340:5:-;9431:1;9414:19;;:5;:19;;;;9406:68;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;9511:1;9492:21;;:7;:21;;;;9484:68;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;9593:6;9563:11;:18;9575:5;9563:18;;;;;;;;;;;;;;;:27;9582:7;9563:27;;;;;;;;;;;;;;;:36;;;;9630:7;9614:32;;9623:5;9614:32;;;9639:6;9614:32;;;;;;;;;;;;;;;;;;9313:340;;;:::o;6989:530::-;7112:1;7094:20;;:6;:20;;;;7086:70;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;7195:1;7174:23;;:9;:23;;;;7166:71;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;7248:47;7269:6;7277:9;7288:6;7248:20;:47::i;:::-;7326:71;7348:6;7326:71;;;;;;;;;;;;;;;;;:9;:17;7336:6;7326:17;;;;;;;;;;;;;;;;:21;;:71;;;;;:::i;:::-;7306:9;:17;7316:6;7306:17;;;;;;;;;;;;;;;:91;;;;7430:32;7455:6;7430:9;:20;7440:9;7430:20;;;;;;;;;;;;;;;;:24;;:32;;;;:::i;:::-;7407:9;:20;7417:9;7407:20;;;;;;;;;;;;;;;:55;;;;7494:9;7477:35;;7486:6;7477:35;;;7505:6;7477:35;;;;;;;;;;;;;;;;;;6989:530;;;:::o;1754:187:4:-;1840:7;1872:1;1867;:6;;1875:12;1859:29;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1898:9;1914:1;1910;:5;1898:17;;1933:1;1926:8;;;1754:187;;;;;:::o;7790:370:5:-;7892:1;7873:21;;:7;:21;;;;7865:65;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;7941:49;7970:1;7974:7;7983:6;7941:20;:49::i;:::-;8016:24;8033:6;8016:12;;:16;;:24;;;;:::i;:::-;8001:12;:39;;;;8071:30;8094:6;8071:9;:18;8081:7;8071:18;;;;;;;;;;;;;;;;:22;;:30;;;;:::i;:::-;8050:9;:18;8060:7;8050:18;;;;;;;;;;;;;;;:51;;;;8137:7;8116:37;;8133:1;8116:37;;;8146:6;8116:37;;;;;;;;;;;;;;;;;;7790:370;;:::o;3109:130:4:-;3167:7;3193:39;3197:1;3200;3193:39;;;;;;;;;;;;;;;;;:3;:39::i;:::-;3186:46;;3109:130;;;;:::o;1329:134::-;1387:7;1413:43;1417:1;1420;1413:43;;;;;;;;;;;;;;;;;:3;:43::i;:::-;1406:50;;1329:134;;;;:::o;2030:154:0:-;2095:35;2105:7;:5;:7::i;:::-;2114:3;2119:10;2095:9;:35::i;:::-;2145:32;2161:3;2166:10;2145:32;;;;;;;;;;;;;;;;;;;;;;;;;;2030:154;;:::o;10651:92:5:-;;;;:::o;3721:272:4:-;3807:7;3838:1;3834;:5;3841:12;3826:28;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;3864:9;3880:1;3876;:5;;;;;;3864:17;;3985:1;3978:8;;;3721:272;;;;;:::o";
    var source = "pragma solidity ^0.7.0;\n\nimport \"@openzeppelin/contracts/token/ERC20/ERC20.sol\";\nimport \"@openzeppelin/contracts/access/Ownable.sol\";\nimport \"@openzeppelin/contracts/math/SafeMath.sol\";\n\n\n// TODO: add an event emit for start time which is listened to on the front end. \n// TODO: find way to incroperate an oracle\n\ncontract EvieCoin is ERC20, Ownable {\n    using SafeMath for uint256;\n    using SafeMath for uint;\n\n    /// @dev the clock in time for an account on a given day\n    mapping (address => uint) private clock_in_times;\n\n    /// @dev check the last clock out day for working. Used to ensure that only one clock out is done per day\n    mapping (address => uint16) private last_clock_in_day;\n\n    event PayoutMadeEvent(address _to, uint value);\n    event ClockInTimeEvent(address user, uint timestamp);\n    event ClockOutTimeEvent(address user, uint timestamp);\n\n    constructor(uint256 initialSupply) ERC20(\"EvieCOIN\", \"EVE\") {\n        transferOwnership(msg.sender);\n        _mint(msg.sender, initialSupply * (10 ** decimals()));\n    }\n\n    modifier _once_per_day() {\n        require(uint16(block.timestamp.div(1 days)) >  last_clock_in_day[msg.sender]);\n        _;\n    }\n\n    /// @dev a user clocks in their start time\n    function clockStartTime() public _once_per_day {\n        clock_in_times[msg.sender] = block.timestamp;\n        last_clock_in_day[msg.sender] = uint16(block.timestamp.div(1 days));\n        clock_in_times[msg.sender];\n        emit ClockInTimeEvent(msg.sender, block.timestamp);\n    }\n\n    // Not exact, it is off by a few minutes?\n    function clockEndTime() public {\n        uint end_time = block.timestamp;\n        require(end_time >= clock_in_times[msg.sender]);\n        if (end_time.sub(clock_in_times[msg.sender]) <= 1 hours) {\n            // Payout one full coin\n            _payout(msg.sender, 1 * (10 ** decimals()));\n        }\n        emit ClockInTimeEvent(msg.sender, block.timestamp);\n    }\n\n    function mint_new(uint amount) public onlyOwner {\n        _mint(owner(), amount);\n    }\n\n    function _payout(address _to, uint reward_val) private {\n        _transfer(owner(), _to, reward_val);\n        emit PayoutMadeEvent(_to, reward_val);\n    }\n}\n";
    var sourcePath = "/home/lev/code/blockchain/eth/evie-timer/contracts/EvieCoin.sol";
    var ast = {
    	absolutePath: "/home/lev/code/blockchain/eth/evie-timer/contracts/EvieCoin.sol",
    	exportedSymbols: {
    		EvieCoin: [
    			213
    		]
    	},
    	id: 214,
    	license: null,
    	nodeType: "SourceUnit",
    	nodes: [
    		{
    			id: 1,
    			literals: [
    				"solidity",
    				"^",
    				"0.7",
    				".0"
    			],
    			nodeType: "PragmaDirective",
    			src: "0:23:0"
    		},
    		{
    			absolutePath: "@openzeppelin/contracts/token/ERC20/ERC20.sol",
    			file: "@openzeppelin/contracts/token/ERC20/ERC20.sol",
    			id: 2,
    			nodeType: "ImportDirective",
    			scope: 214,
    			sourceUnit: 1102,
    			src: "25:55:0",
    			symbolAliases: [
    			],
    			unitAlias: ""
    		},
    		{
    			absolutePath: "@openzeppelin/contracts/access/Ownable.sol",
    			file: "@openzeppelin/contracts/access/Ownable.sol",
    			id: 3,
    			nodeType: "ImportDirective",
    			scope: 214,
    			sourceUnit: 403,
    			src: "81:52:0",
    			symbolAliases: [
    			],
    			unitAlias: ""
    		},
    		{
    			absolutePath: "@openzeppelin/contracts/math/SafeMath.sol",
    			file: "@openzeppelin/contracts/math/SafeMath.sol",
    			id: 4,
    			nodeType: "ImportDirective",
    			scope: 214,
    			sourceUnit: 599,
    			src: "134:51:0",
    			symbolAliases: [
    			],
    			unitAlias: ""
    		},
    		{
    			abstract: false,
    			baseContracts: [
    				{
    					"arguments": null,
    					baseName: {
    						contractScope: null,
    						id: 5,
    						name: "ERC20",
    						nodeType: "UserDefinedTypeName",
    						referencedDeclaration: 1101,
    						src: "335:5:0",
    						typeDescriptions: {
    							typeIdentifier: "t_contract$_ERC20_$1101",
    							typeString: "contract ERC20"
    						}
    					},
    					id: 6,
    					nodeType: "InheritanceSpecifier",
    					src: "335:5:0"
    				},
    				{
    					"arguments": null,
    					baseName: {
    						contractScope: null,
    						id: 7,
    						name: "Ownable",
    						nodeType: "UserDefinedTypeName",
    						referencedDeclaration: 402,
    						src: "342:7:0",
    						typeDescriptions: {
    							typeIdentifier: "t_contract$_Ownable_$402",
    							typeString: "contract Ownable"
    						}
    					},
    					id: 8,
    					nodeType: "InheritanceSpecifier",
    					src: "342:7:0"
    				}
    			],
    			contractDependencies: [
    				293,
    				402,
    				1101,
    				1179
    			],
    			contractKind: "contract",
    			documentation: null,
    			fullyImplemented: true,
    			id: 213,
    			linearizedBaseContracts: [
    				213,
    				402,
    				1101,
    				1179,
    				293
    			],
    			name: "EvieCoin",
    			nodeType: "ContractDefinition",
    			nodes: [
    				{
    					id: 11,
    					libraryName: {
    						contractScope: null,
    						id: 9,
    						name: "SafeMath",
    						nodeType: "UserDefinedTypeName",
    						referencedDeclaration: 598,
    						src: "362:8:0",
    						typeDescriptions: {
    							typeIdentifier: "t_contract$_SafeMath_$598",
    							typeString: "library SafeMath"
    						}
    					},
    					nodeType: "UsingForDirective",
    					src: "356:27:0",
    					typeName: {
    						id: 10,
    						name: "uint256",
    						nodeType: "ElementaryTypeName",
    						src: "375:7:0",
    						typeDescriptions: {
    							typeIdentifier: "t_uint256",
    							typeString: "uint256"
    						}
    					}
    				},
    				{
    					id: 14,
    					libraryName: {
    						contractScope: null,
    						id: 12,
    						name: "SafeMath",
    						nodeType: "UserDefinedTypeName",
    						referencedDeclaration: 598,
    						src: "394:8:0",
    						typeDescriptions: {
    							typeIdentifier: "t_contract$_SafeMath_$598",
    							typeString: "library SafeMath"
    						}
    					},
    					nodeType: "UsingForDirective",
    					src: "388:24:0",
    					typeName: {
    						id: 13,
    						name: "uint",
    						nodeType: "ElementaryTypeName",
    						src: "407:4:0",
    						typeDescriptions: {
    							typeIdentifier: "t_uint256",
    							typeString: "uint256"
    						}
    					}
    				},
    				{
    					constant: false,
    					documentation: {
    						id: 15,
    						nodeType: "StructuredDocumentation",
    						src: "418:56:0",
    						text: "@dev the clock in time for an account on a given day"
    					},
    					id: 19,
    					mutability: "mutable",
    					name: "clock_in_times",
    					nodeType: "VariableDeclaration",
    					overrides: null,
    					scope: 213,
    					src: "479:48:0",
    					stateVariable: true,
    					storageLocation: "default",
    					typeDescriptions: {
    						typeIdentifier: "t_mapping$_t_address_$_t_uint256_$",
    						typeString: "mapping(address => uint256)"
    					},
    					typeName: {
    						id: 18,
    						keyType: {
    							id: 16,
    							name: "address",
    							nodeType: "ElementaryTypeName",
    							src: "488:7:0",
    							typeDescriptions: {
    								typeIdentifier: "t_address",
    								typeString: "address"
    							}
    						},
    						nodeType: "Mapping",
    						src: "479:25:0",
    						typeDescriptions: {
    							typeIdentifier: "t_mapping$_t_address_$_t_uint256_$",
    							typeString: "mapping(address => uint256)"
    						},
    						valueType: {
    							id: 17,
    							name: "uint",
    							nodeType: "ElementaryTypeName",
    							src: "499:4:0",
    							typeDescriptions: {
    								typeIdentifier: "t_uint256",
    								typeString: "uint256"
    							}
    						}
    					},
    					value: null,
    					visibility: "private"
    				},
    				{
    					constant: false,
    					documentation: {
    						id: 20,
    						nodeType: "StructuredDocumentation",
    						src: "534:105:0",
    						text: "@dev check the last clock out day for working. Used to ensure that only one clock out is done per day"
    					},
    					id: 24,
    					mutability: "mutable",
    					name: "last_clock_in_day",
    					nodeType: "VariableDeclaration",
    					overrides: null,
    					scope: 213,
    					src: "644:53:0",
    					stateVariable: true,
    					storageLocation: "default",
    					typeDescriptions: {
    						typeIdentifier: "t_mapping$_t_address_$_t_uint16_$",
    						typeString: "mapping(address => uint16)"
    					},
    					typeName: {
    						id: 23,
    						keyType: {
    							id: 21,
    							name: "address",
    							nodeType: "ElementaryTypeName",
    							src: "653:7:0",
    							typeDescriptions: {
    								typeIdentifier: "t_address",
    								typeString: "address"
    							}
    						},
    						nodeType: "Mapping",
    						src: "644:27:0",
    						typeDescriptions: {
    							typeIdentifier: "t_mapping$_t_address_$_t_uint16_$",
    							typeString: "mapping(address => uint16)"
    						},
    						valueType: {
    							id: 22,
    							name: "uint16",
    							nodeType: "ElementaryTypeName",
    							src: "664:6:0",
    							typeDescriptions: {
    								typeIdentifier: "t_uint16",
    								typeString: "uint16"
    							}
    						}
    					},
    					value: null,
    					visibility: "private"
    				},
    				{
    					anonymous: false,
    					documentation: null,
    					id: 30,
    					name: "PayoutMadeEvent",
    					nodeType: "EventDefinition",
    					parameters: {
    						id: 29,
    						nodeType: "ParameterList",
    						parameters: [
    							{
    								constant: false,
    								id: 26,
    								indexed: false,
    								mutability: "mutable",
    								name: "_to",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 30,
    								src: "726:11:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_address",
    									typeString: "address"
    								},
    								typeName: {
    									id: 25,
    									name: "address",
    									nodeType: "ElementaryTypeName",
    									src: "726:7:0",
    									stateMutability: "nonpayable",
    									typeDescriptions: {
    										typeIdentifier: "t_address",
    										typeString: "address"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							},
    							{
    								constant: false,
    								id: 28,
    								indexed: false,
    								mutability: "mutable",
    								name: "value",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 30,
    								src: "739:10:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_uint256",
    									typeString: "uint256"
    								},
    								typeName: {
    									id: 27,
    									name: "uint",
    									nodeType: "ElementaryTypeName",
    									src: "739:4:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							}
    						],
    						src: "725:25:0"
    					},
    					src: "704:47:0"
    				},
    				{
    					anonymous: false,
    					documentation: null,
    					id: 36,
    					name: "ClockInTimeEvent",
    					nodeType: "EventDefinition",
    					parameters: {
    						id: 35,
    						nodeType: "ParameterList",
    						parameters: [
    							{
    								constant: false,
    								id: 32,
    								indexed: false,
    								mutability: "mutable",
    								name: "user",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 36,
    								src: "779:12:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_address",
    									typeString: "address"
    								},
    								typeName: {
    									id: 31,
    									name: "address",
    									nodeType: "ElementaryTypeName",
    									src: "779:7:0",
    									stateMutability: "nonpayable",
    									typeDescriptions: {
    										typeIdentifier: "t_address",
    										typeString: "address"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							},
    							{
    								constant: false,
    								id: 34,
    								indexed: false,
    								mutability: "mutable",
    								name: "timestamp",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 36,
    								src: "793:14:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_uint256",
    									typeString: "uint256"
    								},
    								typeName: {
    									id: 33,
    									name: "uint",
    									nodeType: "ElementaryTypeName",
    									src: "793:4:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							}
    						],
    						src: "778:30:0"
    					},
    					src: "756:53:0"
    				},
    				{
    					anonymous: false,
    					documentation: null,
    					id: 42,
    					name: "ClockOutTimeEvent",
    					nodeType: "EventDefinition",
    					parameters: {
    						id: 41,
    						nodeType: "ParameterList",
    						parameters: [
    							{
    								constant: false,
    								id: 38,
    								indexed: false,
    								mutability: "mutable",
    								name: "user",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 42,
    								src: "838:12:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_address",
    									typeString: "address"
    								},
    								typeName: {
    									id: 37,
    									name: "address",
    									nodeType: "ElementaryTypeName",
    									src: "838:7:0",
    									stateMutability: "nonpayable",
    									typeDescriptions: {
    										typeIdentifier: "t_address",
    										typeString: "address"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							},
    							{
    								constant: false,
    								id: 40,
    								indexed: false,
    								mutability: "mutable",
    								name: "timestamp",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 42,
    								src: "852:14:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_uint256",
    									typeString: "uint256"
    								},
    								typeName: {
    									id: 39,
    									name: "uint",
    									nodeType: "ElementaryTypeName",
    									src: "852:4:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							}
    						],
    						src: "837:30:0"
    					},
    					src: "814:54:0"
    				},
    				{
    					body: {
    						id: 68,
    						nodeType: "Block",
    						src: "934:109:0",
    						statements: [
    							{
    								expression: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											expression: {
    												argumentTypes: null,
    												id: 52,
    												name: "msg",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: -15,
    												src: "962:3:0",
    												typeDescriptions: {
    													typeIdentifier: "t_magic_message",
    													typeString: "msg"
    												}
    											},
    											id: 53,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "sender",
    											nodeType: "MemberAccess",
    											referencedDeclaration: null,
    											src: "962:10:0",
    											typeDescriptions: {
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											}
    										],
    										id: 51,
    										name: "transferOwnership",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: 401,
    										src: "944:17:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_internal_nonpayable$_t_address_$returns$__$",
    											typeString: "function (address)"
    										}
    									},
    									id: 54,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "944:29:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 55,
    								nodeType: "ExpressionStatement",
    								src: "944:29:0"
    							},
    							{
    								expression: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											expression: {
    												argumentTypes: null,
    												id: 57,
    												name: "msg",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: -15,
    												src: "989:3:0",
    												typeDescriptions: {
    													typeIdentifier: "t_magic_message",
    													typeString: "msg"
    												}
    											},
    											id: 58,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "sender",
    											nodeType: "MemberAccess",
    											referencedDeclaration: null,
    											src: "989:10:0",
    											typeDescriptions: {
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											}
    										},
    										{
    											argumentTypes: null,
    											commonType: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											},
    											id: 65,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											leftExpression: {
    												argumentTypes: null,
    												id: 59,
    												name: "initialSupply",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: 44,
    												src: "1001:13:0",
    												typeDescriptions: {
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											},
    											nodeType: "BinaryOperation",
    											operator: "*",
    											rightExpression: {
    												argumentTypes: null,
    												components: [
    													{
    														argumentTypes: null,
    														commonType: {
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														},
    														id: 63,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														leftExpression: {
    															argumentTypes: null,
    															hexValue: "3130",
    															id: 60,
    															isConstant: false,
    															isLValue: false,
    															isPure: true,
    															kind: "number",
    															lValueRequested: false,
    															nodeType: "Literal",
    															src: "1018:2:0",
    															subdenomination: null,
    															typeDescriptions: {
    																typeIdentifier: "t_rational_10_by_1",
    																typeString: "int_const 10"
    															},
    															value: "10"
    														},
    														nodeType: "BinaryOperation",
    														operator: "**",
    														rightExpression: {
    															argumentTypes: null,
    															"arguments": [
    															],
    															expression: {
    																argumentTypes: [
    																],
    																id: 61,
    																name: "decimals",
    																nodeType: "Identifier",
    																overloadedDeclarations: [
    																],
    																referencedDeclaration: 677,
    																src: "1024:8:0",
    																typeDescriptions: {
    																	typeIdentifier: "t_function_internal_view$__$returns$_t_uint8_$",
    																	typeString: "function () view returns (uint8)"
    																}
    															},
    															id: 62,
    															isConstant: false,
    															isLValue: false,
    															isPure: false,
    															kind: "functionCall",
    															lValueRequested: false,
    															names: [
    															],
    															nodeType: "FunctionCall",
    															src: "1024:10:0",
    															tryCall: false,
    															typeDescriptions: {
    																typeIdentifier: "t_uint8",
    																typeString: "uint8"
    															}
    														},
    														src: "1018:16:0",
    														typeDescriptions: {
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														}
    													}
    												],
    												id: 64,
    												isConstant: false,
    												isInlineArray: false,
    												isLValue: false,
    												isPure: false,
    												lValueRequested: false,
    												nodeType: "TupleExpression",
    												src: "1017:18:0",
    												typeDescriptions: {
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											},
    											src: "1001:34:0",
    											typeDescriptions: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											},
    											{
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										],
    										id: 56,
    										name: "_mint",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: 977,
    										src: "983:5:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_internal_nonpayable$_t_address_$_t_uint256_$returns$__$",
    											typeString: "function (address,uint256)"
    										}
    									},
    									id: 66,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "983:53:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 67,
    								nodeType: "ExpressionStatement",
    								src: "983:53:0"
    							}
    						]
    					},
    					documentation: null,
    					id: 69,
    					implemented: true,
    					kind: "constructor",
    					modifiers: [
    						{
    							"arguments": [
    								{
    									argumentTypes: null,
    									hexValue: "45766965434f494e",
    									id: 47,
    									isConstant: false,
    									isLValue: false,
    									isPure: true,
    									kind: "string",
    									lValueRequested: false,
    									nodeType: "Literal",
    									src: "915:10:0",
    									subdenomination: null,
    									typeDescriptions: {
    										typeIdentifier: "t_stringliteral_a380435aae1dd9717e07f6cdd6e0c710f1e343a25de61444c2b974b3094ba707",
    										typeString: "literal_string \"EvieCOIN\""
    									},
    									value: "EvieCOIN"
    								},
    								{
    									argumentTypes: null,
    									hexValue: "455645",
    									id: 48,
    									isConstant: false,
    									isLValue: false,
    									isPure: true,
    									kind: "string",
    									lValueRequested: false,
    									nodeType: "Literal",
    									src: "927:5:0",
    									subdenomination: null,
    									typeDescriptions: {
    										typeIdentifier: "t_stringliteral_af94fe894bf0e22494392493fc7eb18a0ab98754fe785e74fd233f476b9c37c9",
    										typeString: "literal_string \"EVE\""
    									},
    									value: "EVE"
    								}
    							],
    							id: 49,
    							modifierName: {
    								argumentTypes: null,
    								id: 46,
    								name: "ERC20",
    								nodeType: "Identifier",
    								overloadedDeclarations: [
    								],
    								referencedDeclaration: 1101,
    								src: "909:5:0",
    								typeDescriptions: {
    									typeIdentifier: "t_type$_t_contract$_ERC20_$1101_$",
    									typeString: "type(contract ERC20)"
    								}
    							},
    							nodeType: "ModifierInvocation",
    							src: "909:24:0"
    						}
    					],
    					name: "",
    					nodeType: "FunctionDefinition",
    					overrides: null,
    					parameters: {
    						id: 45,
    						nodeType: "ParameterList",
    						parameters: [
    							{
    								constant: false,
    								id: 44,
    								mutability: "mutable",
    								name: "initialSupply",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 69,
    								src: "886:21:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_uint256",
    									typeString: "uint256"
    								},
    								typeName: {
    									id: 43,
    									name: "uint256",
    									nodeType: "ElementaryTypeName",
    									src: "886:7:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							}
    						],
    						src: "885:23:0"
    					},
    					returnParameters: {
    						id: 50,
    						nodeType: "ParameterList",
    						parameters: [
    						],
    						src: "934:0:0"
    					},
    					scope: 213,
    					src: "874:169:0",
    					stateMutability: "nonpayable",
    					virtual: false,
    					visibility: "public"
    				},
    				{
    					body: {
    						id: 88,
    						nodeType: "Block",
    						src: "1074:105:0",
    						statements: [
    							{
    								expression: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											commonType: {
    												typeIdentifier: "t_uint16",
    												typeString: "uint16"
    											},
    											id: 84,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											leftExpression: {
    												argumentTypes: null,
    												"arguments": [
    													{
    														argumentTypes: null,
    														"arguments": [
    															{
    																argumentTypes: null,
    																hexValue: "31",
    																id: 77,
    																isConstant: false,
    																isLValue: false,
    																isPure: true,
    																kind: "number",
    																lValueRequested: false,
    																nodeType: "Literal",
    																src: "1119:6:0",
    																subdenomination: "days",
    																typeDescriptions: {
    																	typeIdentifier: "t_rational_86400_by_1",
    																	typeString: "int_const 86400"
    																},
    																value: "1"
    															}
    														],
    														expression: {
    															argumentTypes: [
    																{
    																	typeIdentifier: "t_rational_86400_by_1",
    																	typeString: "int_const 86400"
    																}
    															],
    															expression: {
    																argumentTypes: null,
    																expression: {
    																	argumentTypes: null,
    																	id: 74,
    																	name: "block",
    																	nodeType: "Identifier",
    																	overloadedDeclarations: [
    																	],
    																	referencedDeclaration: -4,
    																	src: "1099:5:0",
    																	typeDescriptions: {
    																		typeIdentifier: "t_magic_block",
    																		typeString: "block"
    																	}
    																},
    																id: 75,
    																isConstant: false,
    																isLValue: false,
    																isPure: false,
    																lValueRequested: false,
    																memberName: "timestamp",
    																nodeType: "MemberAccess",
    																referencedDeclaration: null,
    																src: "1099:15:0",
    																typeDescriptions: {
    																	typeIdentifier: "t_uint256",
    																	typeString: "uint256"
    																}
    															},
    															id: 76,
    															isConstant: false,
    															isLValue: false,
    															isPure: false,
    															lValueRequested: false,
    															memberName: "div",
    															nodeType: "MemberAccess",
    															referencedDeclaration: 528,
    															src: "1099:19:0",
    															typeDescriptions: {
    																typeIdentifier: "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$bound_to$_t_uint256_$",
    																typeString: "function (uint256,uint256) pure returns (uint256)"
    															}
    														},
    														id: 78,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														kind: "functionCall",
    														lValueRequested: false,
    														names: [
    														],
    														nodeType: "FunctionCall",
    														src: "1099:27:0",
    														tryCall: false,
    														typeDescriptions: {
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														}
    													}
    												],
    												expression: {
    													argumentTypes: [
    														{
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														}
    													],
    													id: 73,
    													isConstant: false,
    													isLValue: false,
    													isPure: true,
    													lValueRequested: false,
    													nodeType: "ElementaryTypeNameExpression",
    													src: "1092:6:0",
    													typeDescriptions: {
    														typeIdentifier: "t_type$_t_uint16_$",
    														typeString: "type(uint16)"
    													},
    													typeName: {
    														id: 72,
    														name: "uint16",
    														nodeType: "ElementaryTypeName",
    														src: "1092:6:0",
    														typeDescriptions: {
    															typeIdentifier: null,
    															typeString: null
    														}
    													}
    												},
    												id: 79,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												kind: "typeConversion",
    												lValueRequested: false,
    												names: [
    												],
    												nodeType: "FunctionCall",
    												src: "1092:35:0",
    												tryCall: false,
    												typeDescriptions: {
    													typeIdentifier: "t_uint16",
    													typeString: "uint16"
    												}
    											},
    											nodeType: "BinaryOperation",
    											operator: ">",
    											rightExpression: {
    												argumentTypes: null,
    												baseExpression: {
    													argumentTypes: null,
    													id: 80,
    													name: "last_clock_in_day",
    													nodeType: "Identifier",
    													overloadedDeclarations: [
    													],
    													referencedDeclaration: 24,
    													src: "1131:17:0",
    													typeDescriptions: {
    														typeIdentifier: "t_mapping$_t_address_$_t_uint16_$",
    														typeString: "mapping(address => uint16)"
    													}
    												},
    												id: 83,
    												indexExpression: {
    													argumentTypes: null,
    													expression: {
    														argumentTypes: null,
    														id: 81,
    														name: "msg",
    														nodeType: "Identifier",
    														overloadedDeclarations: [
    														],
    														referencedDeclaration: -15,
    														src: "1149:3:0",
    														typeDescriptions: {
    															typeIdentifier: "t_magic_message",
    															typeString: "msg"
    														}
    													},
    													id: 82,
    													isConstant: false,
    													isLValue: false,
    													isPure: false,
    													lValueRequested: false,
    													memberName: "sender",
    													nodeType: "MemberAccess",
    													referencedDeclaration: null,
    													src: "1149:10:0",
    													typeDescriptions: {
    														typeIdentifier: "t_address_payable",
    														typeString: "address payable"
    													}
    												},
    												isConstant: false,
    												isLValue: true,
    												isPure: false,
    												lValueRequested: false,
    												nodeType: "IndexAccess",
    												src: "1131:29:0",
    												typeDescriptions: {
    													typeIdentifier: "t_uint16",
    													typeString: "uint16"
    												}
    											},
    											src: "1092:68:0",
    											typeDescriptions: {
    												typeIdentifier: "t_bool",
    												typeString: "bool"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_bool",
    												typeString: "bool"
    											}
    										],
    										id: 71,
    										name: "require",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    											-18,
    											-18
    										],
    										referencedDeclaration: -18,
    										src: "1084:7:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_require_pure$_t_bool_$returns$__$",
    											typeString: "function (bool) pure"
    										}
    									},
    									id: 85,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "1084:77:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 86,
    								nodeType: "ExpressionStatement",
    								src: "1084:77:0"
    							},
    							{
    								id: 87,
    								nodeType: "PlaceholderStatement",
    								src: "1171:1:0"
    							}
    						]
    					},
    					documentation: null,
    					id: 89,
    					name: "_once_per_day",
    					nodeType: "ModifierDefinition",
    					overrides: null,
    					parameters: {
    						id: 70,
    						nodeType: "ParameterList",
    						parameters: [
    						],
    						src: "1071:2:0"
    					},
    					src: "1049:130:0",
    					virtual: false,
    					visibility: "internal"
    				},
    				{
    					body: {
    						id: 129,
    						nodeType: "Block",
    						src: "1279:234:0",
    						statements: [
    							{
    								expression: {
    									argumentTypes: null,
    									id: 101,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									lValueRequested: false,
    									leftHandSide: {
    										argumentTypes: null,
    										baseExpression: {
    											argumentTypes: null,
    											id: 95,
    											name: "clock_in_times",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: 19,
    											src: "1289:14:0",
    											typeDescriptions: {
    												typeIdentifier: "t_mapping$_t_address_$_t_uint256_$",
    												typeString: "mapping(address => uint256)"
    											}
    										},
    										id: 98,
    										indexExpression: {
    											argumentTypes: null,
    											expression: {
    												argumentTypes: null,
    												id: 96,
    												name: "msg",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: -15,
    												src: "1304:3:0",
    												typeDescriptions: {
    													typeIdentifier: "t_magic_message",
    													typeString: "msg"
    												}
    											},
    											id: 97,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "sender",
    											nodeType: "MemberAccess",
    											referencedDeclaration: null,
    											src: "1304:10:0",
    											typeDescriptions: {
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											}
    										},
    										isConstant: false,
    										isLValue: true,
    										isPure: false,
    										lValueRequested: true,
    										nodeType: "IndexAccess",
    										src: "1289:26:0",
    										typeDescriptions: {
    											typeIdentifier: "t_uint256",
    											typeString: "uint256"
    										}
    									},
    									nodeType: "Assignment",
    									operator: "=",
    									rightHandSide: {
    										argumentTypes: null,
    										expression: {
    											argumentTypes: null,
    											id: 99,
    											name: "block",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: -4,
    											src: "1318:5:0",
    											typeDescriptions: {
    												typeIdentifier: "t_magic_block",
    												typeString: "block"
    											}
    										},
    										id: 100,
    										isConstant: false,
    										isLValue: false,
    										isPure: false,
    										lValueRequested: false,
    										memberName: "timestamp",
    										nodeType: "MemberAccess",
    										referencedDeclaration: null,
    										src: "1318:15:0",
    										typeDescriptions: {
    											typeIdentifier: "t_uint256",
    											typeString: "uint256"
    										}
    									},
    									src: "1289:44:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								id: 102,
    								nodeType: "ExpressionStatement",
    								src: "1289:44:0"
    							},
    							{
    								expression: {
    									argumentTypes: null,
    									id: 115,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									lValueRequested: false,
    									leftHandSide: {
    										argumentTypes: null,
    										baseExpression: {
    											argumentTypes: null,
    											id: 103,
    											name: "last_clock_in_day",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: 24,
    											src: "1343:17:0",
    											typeDescriptions: {
    												typeIdentifier: "t_mapping$_t_address_$_t_uint16_$",
    												typeString: "mapping(address => uint16)"
    											}
    										},
    										id: 106,
    										indexExpression: {
    											argumentTypes: null,
    											expression: {
    												argumentTypes: null,
    												id: 104,
    												name: "msg",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: -15,
    												src: "1361:3:0",
    												typeDescriptions: {
    													typeIdentifier: "t_magic_message",
    													typeString: "msg"
    												}
    											},
    											id: 105,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "sender",
    											nodeType: "MemberAccess",
    											referencedDeclaration: null,
    											src: "1361:10:0",
    											typeDescriptions: {
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											}
    										},
    										isConstant: false,
    										isLValue: true,
    										isPure: false,
    										lValueRequested: true,
    										nodeType: "IndexAccess",
    										src: "1343:29:0",
    										typeDescriptions: {
    											typeIdentifier: "t_uint16",
    											typeString: "uint16"
    										}
    									},
    									nodeType: "Assignment",
    									operator: "=",
    									rightHandSide: {
    										argumentTypes: null,
    										"arguments": [
    											{
    												argumentTypes: null,
    												"arguments": [
    													{
    														argumentTypes: null,
    														hexValue: "31",
    														id: 112,
    														isConstant: false,
    														isLValue: false,
    														isPure: true,
    														kind: "number",
    														lValueRequested: false,
    														nodeType: "Literal",
    														src: "1402:6:0",
    														subdenomination: "days",
    														typeDescriptions: {
    															typeIdentifier: "t_rational_86400_by_1",
    															typeString: "int_const 86400"
    														},
    														value: "1"
    													}
    												],
    												expression: {
    													argumentTypes: [
    														{
    															typeIdentifier: "t_rational_86400_by_1",
    															typeString: "int_const 86400"
    														}
    													],
    													expression: {
    														argumentTypes: null,
    														expression: {
    															argumentTypes: null,
    															id: 109,
    															name: "block",
    															nodeType: "Identifier",
    															overloadedDeclarations: [
    															],
    															referencedDeclaration: -4,
    															src: "1382:5:0",
    															typeDescriptions: {
    																typeIdentifier: "t_magic_block",
    																typeString: "block"
    															}
    														},
    														id: 110,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														memberName: "timestamp",
    														nodeType: "MemberAccess",
    														referencedDeclaration: null,
    														src: "1382:15:0",
    														typeDescriptions: {
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														}
    													},
    													id: 111,
    													isConstant: false,
    													isLValue: false,
    													isPure: false,
    													lValueRequested: false,
    													memberName: "div",
    													nodeType: "MemberAccess",
    													referencedDeclaration: 528,
    													src: "1382:19:0",
    													typeDescriptions: {
    														typeIdentifier: "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$bound_to$_t_uint256_$",
    														typeString: "function (uint256,uint256) pure returns (uint256)"
    													}
    												},
    												id: 113,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												kind: "functionCall",
    												lValueRequested: false,
    												names: [
    												],
    												nodeType: "FunctionCall",
    												src: "1382:27:0",
    												tryCall: false,
    												typeDescriptions: {
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											}
    										],
    										expression: {
    											argumentTypes: [
    												{
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											],
    											id: 108,
    											isConstant: false,
    											isLValue: false,
    											isPure: true,
    											lValueRequested: false,
    											nodeType: "ElementaryTypeNameExpression",
    											src: "1375:6:0",
    											typeDescriptions: {
    												typeIdentifier: "t_type$_t_uint16_$",
    												typeString: "type(uint16)"
    											},
    											typeName: {
    												id: 107,
    												name: "uint16",
    												nodeType: "ElementaryTypeName",
    												src: "1375:6:0",
    												typeDescriptions: {
    													typeIdentifier: null,
    													typeString: null
    												}
    											}
    										},
    										id: 114,
    										isConstant: false,
    										isLValue: false,
    										isPure: false,
    										kind: "typeConversion",
    										lValueRequested: false,
    										names: [
    										],
    										nodeType: "FunctionCall",
    										src: "1375:35:0",
    										tryCall: false,
    										typeDescriptions: {
    											typeIdentifier: "t_uint16",
    											typeString: "uint16"
    										}
    									},
    									src: "1343:67:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint16",
    										typeString: "uint16"
    									}
    								},
    								id: 116,
    								nodeType: "ExpressionStatement",
    								src: "1343:67:0"
    							},
    							{
    								expression: {
    									argumentTypes: null,
    									baseExpression: {
    										argumentTypes: null,
    										id: 117,
    										name: "clock_in_times",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: 19,
    										src: "1420:14:0",
    										typeDescriptions: {
    											typeIdentifier: "t_mapping$_t_address_$_t_uint256_$",
    											typeString: "mapping(address => uint256)"
    										}
    									},
    									id: 120,
    									indexExpression: {
    										argumentTypes: null,
    										expression: {
    											argumentTypes: null,
    											id: 118,
    											name: "msg",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: -15,
    											src: "1435:3:0",
    											typeDescriptions: {
    												typeIdentifier: "t_magic_message",
    												typeString: "msg"
    											}
    										},
    										id: 119,
    										isConstant: false,
    										isLValue: false,
    										isPure: false,
    										lValueRequested: false,
    										memberName: "sender",
    										nodeType: "MemberAccess",
    										referencedDeclaration: null,
    										src: "1435:10:0",
    										typeDescriptions: {
    											typeIdentifier: "t_address_payable",
    											typeString: "address payable"
    										}
    									},
    									isConstant: false,
    									isLValue: true,
    									isPure: false,
    									lValueRequested: false,
    									nodeType: "IndexAccess",
    									src: "1420:26:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								id: 121,
    								nodeType: "ExpressionStatement",
    								src: "1420:26:0"
    							},
    							{
    								eventCall: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											expression: {
    												argumentTypes: null,
    												id: 123,
    												name: "msg",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: -15,
    												src: "1478:3:0",
    												typeDescriptions: {
    													typeIdentifier: "t_magic_message",
    													typeString: "msg"
    												}
    											},
    											id: 124,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "sender",
    											nodeType: "MemberAccess",
    											referencedDeclaration: null,
    											src: "1478:10:0",
    											typeDescriptions: {
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											}
    										},
    										{
    											argumentTypes: null,
    											expression: {
    												argumentTypes: null,
    												id: 125,
    												name: "block",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: -4,
    												src: "1490:5:0",
    												typeDescriptions: {
    													typeIdentifier: "t_magic_block",
    													typeString: "block"
    												}
    											},
    											id: 126,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "timestamp",
    											nodeType: "MemberAccess",
    											referencedDeclaration: null,
    											src: "1490:15:0",
    											typeDescriptions: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											},
    											{
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										],
    										id: 122,
    										name: "ClockInTimeEvent",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: 36,
    										src: "1461:16:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_event_nonpayable$_t_address_$_t_uint256_$returns$__$",
    											typeString: "function (address,uint256)"
    										}
    									},
    									id: 127,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "1461:45:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 128,
    								nodeType: "EmitStatement",
    								src: "1456:50:0"
    							}
    						]
    					},
    					documentation: {
    						id: 90,
    						nodeType: "StructuredDocumentation",
    						src: "1185:42:0",
    						text: "@dev a user clocks in their start time"
    					},
    					functionSelector: "a481aada",
    					id: 130,
    					implemented: true,
    					kind: "function",
    					modifiers: [
    						{
    							"arguments": null,
    							id: 93,
    							modifierName: {
    								argumentTypes: null,
    								id: 92,
    								name: "_once_per_day",
    								nodeType: "Identifier",
    								overloadedDeclarations: [
    								],
    								referencedDeclaration: 89,
    								src: "1265:13:0",
    								typeDescriptions: {
    									typeIdentifier: "t_modifier$__$",
    									typeString: "modifier ()"
    								}
    							},
    							nodeType: "ModifierInvocation",
    							src: "1265:13:0"
    						}
    					],
    					name: "clockStartTime",
    					nodeType: "FunctionDefinition",
    					overrides: null,
    					parameters: {
    						id: 91,
    						nodeType: "ParameterList",
    						parameters: [
    						],
    						src: "1255:2:0"
    					},
    					returnParameters: {
    						id: 94,
    						nodeType: "ParameterList",
    						parameters: [
    						],
    						src: "1279:0:0"
    					},
    					scope: 213,
    					src: "1232:281:0",
    					stateMutability: "nonpayable",
    					virtual: false,
    					visibility: "public"
    				},
    				{
    					body: {
    						id: 177,
    						nodeType: "Block",
    						src: "1596:335:0",
    						statements: [
    							{
    								assignments: [
    									134
    								],
    								declarations: [
    									{
    										constant: false,
    										id: 134,
    										mutability: "mutable",
    										name: "end_time",
    										nodeType: "VariableDeclaration",
    										overrides: null,
    										scope: 177,
    										src: "1606:13:0",
    										stateVariable: false,
    										storageLocation: "default",
    										typeDescriptions: {
    											typeIdentifier: "t_uint256",
    											typeString: "uint256"
    										},
    										typeName: {
    											id: 133,
    											name: "uint",
    											nodeType: "ElementaryTypeName",
    											src: "1606:4:0",
    											typeDescriptions: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										},
    										value: null,
    										visibility: "internal"
    									}
    								],
    								id: 137,
    								initialValue: {
    									argumentTypes: null,
    									expression: {
    										argumentTypes: null,
    										id: 135,
    										name: "block",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: -4,
    										src: "1622:5:0",
    										typeDescriptions: {
    											typeIdentifier: "t_magic_block",
    											typeString: "block"
    										}
    									},
    									id: 136,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									lValueRequested: false,
    									memberName: "timestamp",
    									nodeType: "MemberAccess",
    									referencedDeclaration: null,
    									src: "1622:15:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								nodeType: "VariableDeclarationStatement",
    								src: "1606:31:0"
    							},
    							{
    								expression: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											commonType: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											},
    											id: 144,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											leftExpression: {
    												argumentTypes: null,
    												id: 139,
    												name: "end_time",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: 134,
    												src: "1655:8:0",
    												typeDescriptions: {
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											},
    											nodeType: "BinaryOperation",
    											operator: ">=",
    											rightExpression: {
    												argumentTypes: null,
    												baseExpression: {
    													argumentTypes: null,
    													id: 140,
    													name: "clock_in_times",
    													nodeType: "Identifier",
    													overloadedDeclarations: [
    													],
    													referencedDeclaration: 19,
    													src: "1667:14:0",
    													typeDescriptions: {
    														typeIdentifier: "t_mapping$_t_address_$_t_uint256_$",
    														typeString: "mapping(address => uint256)"
    													}
    												},
    												id: 143,
    												indexExpression: {
    													argumentTypes: null,
    													expression: {
    														argumentTypes: null,
    														id: 141,
    														name: "msg",
    														nodeType: "Identifier",
    														overloadedDeclarations: [
    														],
    														referencedDeclaration: -15,
    														src: "1682:3:0",
    														typeDescriptions: {
    															typeIdentifier: "t_magic_message",
    															typeString: "msg"
    														}
    													},
    													id: 142,
    													isConstant: false,
    													isLValue: false,
    													isPure: false,
    													lValueRequested: false,
    													memberName: "sender",
    													nodeType: "MemberAccess",
    													referencedDeclaration: null,
    													src: "1682:10:0",
    													typeDescriptions: {
    														typeIdentifier: "t_address_payable",
    														typeString: "address payable"
    													}
    												},
    												isConstant: false,
    												isLValue: true,
    												isPure: false,
    												lValueRequested: false,
    												nodeType: "IndexAccess",
    												src: "1667:26:0",
    												typeDescriptions: {
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											},
    											src: "1655:38:0",
    											typeDescriptions: {
    												typeIdentifier: "t_bool",
    												typeString: "bool"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_bool",
    												typeString: "bool"
    											}
    										],
    										id: 138,
    										name: "require",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    											-18,
    											-18
    										],
    										referencedDeclaration: -18,
    										src: "1647:7:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_require_pure$_t_bool_$returns$__$",
    											typeString: "function (bool) pure"
    										}
    									},
    									id: 145,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "1647:47:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 146,
    								nodeType: "ExpressionStatement",
    								src: "1647:47:0"
    							},
    							{
    								condition: {
    									argumentTypes: null,
    									commonType: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									},
    									id: 155,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									lValueRequested: false,
    									leftExpression: {
    										argumentTypes: null,
    										"arguments": [
    											{
    												argumentTypes: null,
    												baseExpression: {
    													argumentTypes: null,
    													id: 149,
    													name: "clock_in_times",
    													nodeType: "Identifier",
    													overloadedDeclarations: [
    													],
    													referencedDeclaration: 19,
    													src: "1721:14:0",
    													typeDescriptions: {
    														typeIdentifier: "t_mapping$_t_address_$_t_uint256_$",
    														typeString: "mapping(address => uint256)"
    													}
    												},
    												id: 152,
    												indexExpression: {
    													argumentTypes: null,
    													expression: {
    														argumentTypes: null,
    														id: 150,
    														name: "msg",
    														nodeType: "Identifier",
    														overloadedDeclarations: [
    														],
    														referencedDeclaration: -15,
    														src: "1736:3:0",
    														typeDescriptions: {
    															typeIdentifier: "t_magic_message",
    															typeString: "msg"
    														}
    													},
    													id: 151,
    													isConstant: false,
    													isLValue: false,
    													isPure: false,
    													lValueRequested: false,
    													memberName: "sender",
    													nodeType: "MemberAccess",
    													referencedDeclaration: null,
    													src: "1736:10:0",
    													typeDescriptions: {
    														typeIdentifier: "t_address_payable",
    														typeString: "address payable"
    													}
    												},
    												isConstant: false,
    												isLValue: true,
    												isPure: false,
    												lValueRequested: false,
    												nodeType: "IndexAccess",
    												src: "1721:26:0",
    												typeDescriptions: {
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											}
    										],
    										expression: {
    											argumentTypes: [
    												{
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											],
    											expression: {
    												argumentTypes: null,
    												id: 147,
    												name: "end_time",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: 134,
    												src: "1708:8:0",
    												typeDescriptions: {
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												}
    											},
    											id: 148,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "sub",
    											nodeType: "MemberAccess",
    											referencedDeclaration: 448,
    											src: "1708:12:0",
    											typeDescriptions: {
    												typeIdentifier: "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$bound_to$_t_uint256_$",
    												typeString: "function (uint256,uint256) pure returns (uint256)"
    											}
    										},
    										id: 153,
    										isConstant: false,
    										isLValue: false,
    										isPure: false,
    										kind: "functionCall",
    										lValueRequested: false,
    										names: [
    										],
    										nodeType: "FunctionCall",
    										src: "1708:40:0",
    										tryCall: false,
    										typeDescriptions: {
    											typeIdentifier: "t_uint256",
    											typeString: "uint256"
    										}
    									},
    									nodeType: "BinaryOperation",
    									operator: "<=",
    									rightExpression: {
    										argumentTypes: null,
    										hexValue: "31",
    										id: 154,
    										isConstant: false,
    										isLValue: false,
    										isPure: true,
    										kind: "number",
    										lValueRequested: false,
    										nodeType: "Literal",
    										src: "1752:7:0",
    										subdenomination: "hours",
    										typeDescriptions: {
    											typeIdentifier: "t_rational_3600_by_1",
    											typeString: "int_const 3600"
    										},
    										value: "1"
    									},
    									src: "1708:51:0",
    									typeDescriptions: {
    										typeIdentifier: "t_bool",
    										typeString: "bool"
    									}
    								},
    								falseBody: null,
    								id: 169,
    								nodeType: "IfStatement",
    								src: "1704:161:0",
    								trueBody: {
    									id: 168,
    									nodeType: "Block",
    									src: "1761:104:0",
    									statements: [
    										{
    											expression: {
    												argumentTypes: null,
    												"arguments": [
    													{
    														argumentTypes: null,
    														expression: {
    															argumentTypes: null,
    															id: 157,
    															name: "msg",
    															nodeType: "Identifier",
    															overloadedDeclarations: [
    															],
    															referencedDeclaration: -15,
    															src: "1819:3:0",
    															typeDescriptions: {
    																typeIdentifier: "t_magic_message",
    																typeString: "msg"
    															}
    														},
    														id: 158,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														memberName: "sender",
    														nodeType: "MemberAccess",
    														referencedDeclaration: null,
    														src: "1819:10:0",
    														typeDescriptions: {
    															typeIdentifier: "t_address_payable",
    															typeString: "address payable"
    														}
    													},
    													{
    														argumentTypes: null,
    														commonType: {
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														},
    														id: 165,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														leftExpression: {
    															argumentTypes: null,
    															hexValue: "31",
    															id: 159,
    															isConstant: false,
    															isLValue: false,
    															isPure: true,
    															kind: "number",
    															lValueRequested: false,
    															nodeType: "Literal",
    															src: "1831:1:0",
    															subdenomination: null,
    															typeDescriptions: {
    																typeIdentifier: "t_rational_1_by_1",
    																typeString: "int_const 1"
    															},
    															value: "1"
    														},
    														nodeType: "BinaryOperation",
    														operator: "*",
    														rightExpression: {
    															argumentTypes: null,
    															components: [
    																{
    																	argumentTypes: null,
    																	commonType: {
    																		typeIdentifier: "t_uint256",
    																		typeString: "uint256"
    																	},
    																	id: 163,
    																	isConstant: false,
    																	isLValue: false,
    																	isPure: false,
    																	lValueRequested: false,
    																	leftExpression: {
    																		argumentTypes: null,
    																		hexValue: "3130",
    																		id: 160,
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: true,
    																		kind: "number",
    																		lValueRequested: false,
    																		nodeType: "Literal",
    																		src: "1836:2:0",
    																		subdenomination: null,
    																		typeDescriptions: {
    																			typeIdentifier: "t_rational_10_by_1",
    																			typeString: "int_const 10"
    																		},
    																		value: "10"
    																	},
    																	nodeType: "BinaryOperation",
    																	operator: "**",
    																	rightExpression: {
    																		argumentTypes: null,
    																		"arguments": [
    																		],
    																		expression: {
    																			argumentTypes: [
    																			],
    																			id: 161,
    																			name: "decimals",
    																			nodeType: "Identifier",
    																			overloadedDeclarations: [
    																			],
    																			referencedDeclaration: 677,
    																			src: "1842:8:0",
    																			typeDescriptions: {
    																				typeIdentifier: "t_function_internal_view$__$returns$_t_uint8_$",
    																				typeString: "function () view returns (uint8)"
    																			}
    																		},
    																		id: 162,
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		kind: "functionCall",
    																		lValueRequested: false,
    																		names: [
    																		],
    																		nodeType: "FunctionCall",
    																		src: "1842:10:0",
    																		tryCall: false,
    																		typeDescriptions: {
    																			typeIdentifier: "t_uint8",
    																			typeString: "uint8"
    																		}
    																	},
    																	src: "1836:16:0",
    																	typeDescriptions: {
    																		typeIdentifier: "t_uint256",
    																		typeString: "uint256"
    																	}
    																}
    															],
    															id: 164,
    															isConstant: false,
    															isInlineArray: false,
    															isLValue: false,
    															isPure: false,
    															lValueRequested: false,
    															nodeType: "TupleExpression",
    															src: "1835:18:0",
    															typeDescriptions: {
    																typeIdentifier: "t_uint256",
    																typeString: "uint256"
    															}
    														},
    														src: "1831:22:0",
    														typeDescriptions: {
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														}
    													}
    												],
    												expression: {
    													argumentTypes: [
    														{
    															typeIdentifier: "t_address_payable",
    															typeString: "address payable"
    														},
    														{
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														}
    													],
    													id: 156,
    													name: "_payout",
    													nodeType: "Identifier",
    													overloadedDeclarations: [
    													],
    													referencedDeclaration: 212,
    													src: "1811:7:0",
    													typeDescriptions: {
    														typeIdentifier: "t_function_internal_nonpayable$_t_address_$_t_uint256_$returns$__$",
    														typeString: "function (address,uint256)"
    													}
    												},
    												id: 166,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												kind: "functionCall",
    												lValueRequested: false,
    												names: [
    												],
    												nodeType: "FunctionCall",
    												src: "1811:43:0",
    												tryCall: false,
    												typeDescriptions: {
    													typeIdentifier: "t_tuple$__$",
    													typeString: "tuple()"
    												}
    											},
    											id: 167,
    											nodeType: "ExpressionStatement",
    											src: "1811:43:0"
    										}
    									]
    								}
    							},
    							{
    								eventCall: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											expression: {
    												argumentTypes: null,
    												id: 171,
    												name: "msg",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: -15,
    												src: "1896:3:0",
    												typeDescriptions: {
    													typeIdentifier: "t_magic_message",
    													typeString: "msg"
    												}
    											},
    											id: 172,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "sender",
    											nodeType: "MemberAccess",
    											referencedDeclaration: null,
    											src: "1896:10:0",
    											typeDescriptions: {
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											}
    										},
    										{
    											argumentTypes: null,
    											expression: {
    												argumentTypes: null,
    												id: 173,
    												name: "block",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: -4,
    												src: "1908:5:0",
    												typeDescriptions: {
    													typeIdentifier: "t_magic_block",
    													typeString: "block"
    												}
    											},
    											id: 174,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											lValueRequested: false,
    											memberName: "timestamp",
    											nodeType: "MemberAccess",
    											referencedDeclaration: null,
    											src: "1908:15:0",
    											typeDescriptions: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_address_payable",
    												typeString: "address payable"
    											},
    											{
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										],
    										id: 170,
    										name: "ClockInTimeEvent",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: 36,
    										src: "1879:16:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_event_nonpayable$_t_address_$_t_uint256_$returns$__$",
    											typeString: "function (address,uint256)"
    										}
    									},
    									id: 175,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "1879:45:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 176,
    								nodeType: "EmitStatement",
    								src: "1874:50:0"
    							}
    						]
    					},
    					documentation: null,
    					functionSelector: "b939df59",
    					id: 178,
    					implemented: true,
    					kind: "function",
    					modifiers: [
    					],
    					name: "clockEndTime",
    					nodeType: "FunctionDefinition",
    					overrides: null,
    					parameters: {
    						id: 131,
    						nodeType: "ParameterList",
    						parameters: [
    						],
    						src: "1586:2:0"
    					},
    					returnParameters: {
    						id: 132,
    						nodeType: "ParameterList",
    						parameters: [
    						],
    						src: "1596:0:0"
    					},
    					scope: 213,
    					src: "1565:366:0",
    					stateMutability: "nonpayable",
    					virtual: false,
    					visibility: "public"
    				},
    				{
    					body: {
    						id: 191,
    						nodeType: "Block",
    						src: "1985:39:0",
    						statements: [
    							{
    								expression: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											"arguments": [
    											],
    											expression: {
    												argumentTypes: [
    												],
    												id: 186,
    												name: "owner",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: 338,
    												src: "2001:5:0",
    												typeDescriptions: {
    													typeIdentifier: "t_function_internal_view$__$returns$_t_address_$",
    													typeString: "function () view returns (address)"
    												}
    											},
    											id: 187,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											kind: "functionCall",
    											lValueRequested: false,
    											names: [
    											],
    											nodeType: "FunctionCall",
    											src: "2001:7:0",
    											tryCall: false,
    											typeDescriptions: {
    												typeIdentifier: "t_address",
    												typeString: "address"
    											}
    										},
    										{
    											argumentTypes: null,
    											id: 188,
    											name: "amount",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: 180,
    											src: "2010:6:0",
    											typeDescriptions: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_address",
    												typeString: "address"
    											},
    											{
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										],
    										id: 185,
    										name: "_mint",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: 977,
    										src: "1995:5:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_internal_nonpayable$_t_address_$_t_uint256_$returns$__$",
    											typeString: "function (address,uint256)"
    										}
    									},
    									id: 189,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "1995:22:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 190,
    								nodeType: "ExpressionStatement",
    								src: "1995:22:0"
    							}
    						]
    					},
    					documentation: null,
    					functionSelector: "5a9ece24",
    					id: 192,
    					implemented: true,
    					kind: "function",
    					modifiers: [
    						{
    							"arguments": null,
    							id: 183,
    							modifierName: {
    								argumentTypes: null,
    								id: 182,
    								name: "onlyOwner",
    								nodeType: "Identifier",
    								overloadedDeclarations: [
    								],
    								referencedDeclaration: 351,
    								src: "1975:9:0",
    								typeDescriptions: {
    									typeIdentifier: "t_modifier$__$",
    									typeString: "modifier ()"
    								}
    							},
    							nodeType: "ModifierInvocation",
    							src: "1975:9:0"
    						}
    					],
    					name: "mint_new",
    					nodeType: "FunctionDefinition",
    					overrides: null,
    					parameters: {
    						id: 181,
    						nodeType: "ParameterList",
    						parameters: [
    							{
    								constant: false,
    								id: 180,
    								mutability: "mutable",
    								name: "amount",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 192,
    								src: "1955:11:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_uint256",
    									typeString: "uint256"
    								},
    								typeName: {
    									id: 179,
    									name: "uint",
    									nodeType: "ElementaryTypeName",
    									src: "1955:4:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							}
    						],
    						src: "1954:13:0"
    					},
    					returnParameters: {
    						id: 184,
    						nodeType: "ParameterList",
    						parameters: [
    						],
    						src: "1985:0:0"
    					},
    					scope: 213,
    					src: "1937:87:0",
    					stateMutability: "nonpayable",
    					virtual: false,
    					visibility: "public"
    				},
    				{
    					body: {
    						id: 211,
    						nodeType: "Block",
    						src: "2085:99:0",
    						statements: [
    							{
    								expression: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											"arguments": [
    											],
    											expression: {
    												argumentTypes: [
    												],
    												id: 200,
    												name: "owner",
    												nodeType: "Identifier",
    												overloadedDeclarations: [
    												],
    												referencedDeclaration: 338,
    												src: "2105:5:0",
    												typeDescriptions: {
    													typeIdentifier: "t_function_internal_view$__$returns$_t_address_$",
    													typeString: "function () view returns (address)"
    												}
    											},
    											id: 201,
    											isConstant: false,
    											isLValue: false,
    											isPure: false,
    											kind: "functionCall",
    											lValueRequested: false,
    											names: [
    											],
    											nodeType: "FunctionCall",
    											src: "2105:7:0",
    											tryCall: false,
    											typeDescriptions: {
    												typeIdentifier: "t_address",
    												typeString: "address"
    											}
    										},
    										{
    											argumentTypes: null,
    											id: 202,
    											name: "_to",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: 194,
    											src: "2114:3:0",
    											typeDescriptions: {
    												typeIdentifier: "t_address",
    												typeString: "address"
    											}
    										},
    										{
    											argumentTypes: null,
    											id: 203,
    											name: "reward_val",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: 196,
    											src: "2119:10:0",
    											typeDescriptions: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_address",
    												typeString: "address"
    											},
    											{
    												typeIdentifier: "t_address",
    												typeString: "address"
    											},
    											{
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										],
    										id: 199,
    										name: "_transfer",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: 922,
    										src: "2095:9:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_internal_nonpayable$_t_address_$_t_address_$_t_uint256_$returns$__$",
    											typeString: "function (address,address,uint256)"
    										}
    									},
    									id: 204,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "2095:35:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 205,
    								nodeType: "ExpressionStatement",
    								src: "2095:35:0"
    							},
    							{
    								eventCall: {
    									argumentTypes: null,
    									"arguments": [
    										{
    											argumentTypes: null,
    											id: 207,
    											name: "_to",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: 194,
    											src: "2161:3:0",
    											typeDescriptions: {
    												typeIdentifier: "t_address",
    												typeString: "address"
    											}
    										},
    										{
    											argumentTypes: null,
    											id: 208,
    											name: "reward_val",
    											nodeType: "Identifier",
    											overloadedDeclarations: [
    											],
    											referencedDeclaration: 196,
    											src: "2166:10:0",
    											typeDescriptions: {
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										}
    									],
    									expression: {
    										argumentTypes: [
    											{
    												typeIdentifier: "t_address",
    												typeString: "address"
    											},
    											{
    												typeIdentifier: "t_uint256",
    												typeString: "uint256"
    											}
    										],
    										id: 206,
    										name: "PayoutMadeEvent",
    										nodeType: "Identifier",
    										overloadedDeclarations: [
    										],
    										referencedDeclaration: 30,
    										src: "2145:15:0",
    										typeDescriptions: {
    											typeIdentifier: "t_function_event_nonpayable$_t_address_$_t_uint256_$returns$__$",
    											typeString: "function (address,uint256)"
    										}
    									},
    									id: 209,
    									isConstant: false,
    									isLValue: false,
    									isPure: false,
    									kind: "functionCall",
    									lValueRequested: false,
    									names: [
    									],
    									nodeType: "FunctionCall",
    									src: "2145:32:0",
    									tryCall: false,
    									typeDescriptions: {
    										typeIdentifier: "t_tuple$__$",
    										typeString: "tuple()"
    									}
    								},
    								id: 210,
    								nodeType: "EmitStatement",
    								src: "2140:37:0"
    							}
    						]
    					},
    					documentation: null,
    					id: 212,
    					implemented: true,
    					kind: "function",
    					modifiers: [
    					],
    					name: "_payout",
    					nodeType: "FunctionDefinition",
    					overrides: null,
    					parameters: {
    						id: 197,
    						nodeType: "ParameterList",
    						parameters: [
    							{
    								constant: false,
    								id: 194,
    								mutability: "mutable",
    								name: "_to",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 212,
    								src: "2047:11:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_address",
    									typeString: "address"
    								},
    								typeName: {
    									id: 193,
    									name: "address",
    									nodeType: "ElementaryTypeName",
    									src: "2047:7:0",
    									stateMutability: "nonpayable",
    									typeDescriptions: {
    										typeIdentifier: "t_address",
    										typeString: "address"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							},
    							{
    								constant: false,
    								id: 196,
    								mutability: "mutable",
    								name: "reward_val",
    								nodeType: "VariableDeclaration",
    								overrides: null,
    								scope: 212,
    								src: "2060:15:0",
    								stateVariable: false,
    								storageLocation: "default",
    								typeDescriptions: {
    									typeIdentifier: "t_uint256",
    									typeString: "uint256"
    								},
    								typeName: {
    									id: 195,
    									name: "uint",
    									nodeType: "ElementaryTypeName",
    									src: "2060:4:0",
    									typeDescriptions: {
    										typeIdentifier: "t_uint256",
    										typeString: "uint256"
    									}
    								},
    								value: null,
    								visibility: "internal"
    							}
    						],
    						src: "2046:30:0"
    					},
    					returnParameters: {
    						id: 198,
    						nodeType: "ParameterList",
    						parameters: [
    						],
    						src: "2085:0:0"
    					},
    					scope: 213,
    					src: "2030:154:0",
    					stateMutability: "nonpayable",
    					virtual: false,
    					visibility: "private"
    				}
    			],
    			scope: 214,
    			src: "314:1872:0"
    		}
    	],
    	src: "0:2187:0"
    };
    var legacyAST = {
    	attributes: {
    		absolutePath: "/home/lev/code/blockchain/eth/evie-timer/contracts/EvieCoin.sol",
    		exportedSymbols: {
    			EvieCoin: [
    				213
    			]
    		},
    		license: null
    	},
    	children: [
    		{
    			attributes: {
    				literals: [
    					"solidity",
    					"^",
    					"0.7",
    					".0"
    				]
    			},
    			id: 1,
    			name: "PragmaDirective",
    			src: "0:23:0"
    		},
    		{
    			attributes: {
    				SourceUnit: 1102,
    				absolutePath: "@openzeppelin/contracts/token/ERC20/ERC20.sol",
    				file: "@openzeppelin/contracts/token/ERC20/ERC20.sol",
    				scope: 214,
    				symbolAliases: [
    					null
    				],
    				unitAlias: ""
    			},
    			id: 2,
    			name: "ImportDirective",
    			src: "25:55:0"
    		},
    		{
    			attributes: {
    				SourceUnit: 403,
    				absolutePath: "@openzeppelin/contracts/access/Ownable.sol",
    				file: "@openzeppelin/contracts/access/Ownable.sol",
    				scope: 214,
    				symbolAliases: [
    					null
    				],
    				unitAlias: ""
    			},
    			id: 3,
    			name: "ImportDirective",
    			src: "81:52:0"
    		},
    		{
    			attributes: {
    				SourceUnit: 599,
    				absolutePath: "@openzeppelin/contracts/math/SafeMath.sol",
    				file: "@openzeppelin/contracts/math/SafeMath.sol",
    				scope: 214,
    				symbolAliases: [
    					null
    				],
    				unitAlias: ""
    			},
    			id: 4,
    			name: "ImportDirective",
    			src: "134:51:0"
    		},
    		{
    			attributes: {
    				abstract: false,
    				contractDependencies: [
    					293,
    					402,
    					1101,
    					1179
    				],
    				contractKind: "contract",
    				documentation: null,
    				fullyImplemented: true,
    				linearizedBaseContracts: [
    					213,
    					402,
    					1101,
    					1179,
    					293
    				],
    				name: "EvieCoin",
    				scope: 214
    			},
    			children: [
    				{
    					attributes: {
    						"arguments": null
    					},
    					children: [
    						{
    							attributes: {
    								contractScope: null,
    								name: "ERC20",
    								referencedDeclaration: 1101,
    								type: "contract ERC20"
    							},
    							id: 5,
    							name: "UserDefinedTypeName",
    							src: "335:5:0"
    						}
    					],
    					id: 6,
    					name: "InheritanceSpecifier",
    					src: "335:5:0"
    				},
    				{
    					attributes: {
    						"arguments": null
    					},
    					children: [
    						{
    							attributes: {
    								contractScope: null,
    								name: "Ownable",
    								referencedDeclaration: 402,
    								type: "contract Ownable"
    							},
    							id: 7,
    							name: "UserDefinedTypeName",
    							src: "342:7:0"
    						}
    					],
    					id: 8,
    					name: "InheritanceSpecifier",
    					src: "342:7:0"
    				},
    				{
    					children: [
    						{
    							attributes: {
    								contractScope: null,
    								name: "SafeMath",
    								referencedDeclaration: 598,
    								type: "library SafeMath"
    							},
    							id: 9,
    							name: "UserDefinedTypeName",
    							src: "362:8:0"
    						},
    						{
    							attributes: {
    								name: "uint256",
    								type: "uint256"
    							},
    							id: 10,
    							name: "ElementaryTypeName",
    							src: "375:7:0"
    						}
    					],
    					id: 11,
    					name: "UsingForDirective",
    					src: "356:27:0"
    				},
    				{
    					children: [
    						{
    							attributes: {
    								contractScope: null,
    								name: "SafeMath",
    								referencedDeclaration: 598,
    								type: "library SafeMath"
    							},
    							id: 12,
    							name: "UserDefinedTypeName",
    							src: "394:8:0"
    						},
    						{
    							attributes: {
    								name: "uint",
    								type: "uint256"
    							},
    							id: 13,
    							name: "ElementaryTypeName",
    							src: "407:4:0"
    						}
    					],
    					id: 14,
    					name: "UsingForDirective",
    					src: "388:24:0"
    				},
    				{
    					attributes: {
    						constant: false,
    						mutability: "mutable",
    						name: "clock_in_times",
    						overrides: null,
    						scope: 213,
    						stateVariable: true,
    						storageLocation: "default",
    						type: "mapping(address => uint256)",
    						value: null,
    						visibility: "private"
    					},
    					children: [
    						{
    							attributes: {
    								type: "mapping(address => uint256)"
    							},
    							children: [
    								{
    									attributes: {
    										name: "address",
    										type: "address"
    									},
    									id: 16,
    									name: "ElementaryTypeName",
    									src: "488:7:0"
    								},
    								{
    									attributes: {
    										name: "uint",
    										type: "uint256"
    									},
    									id: 17,
    									name: "ElementaryTypeName",
    									src: "499:4:0"
    								}
    							],
    							id: 18,
    							name: "Mapping",
    							src: "479:25:0"
    						},
    						{
    							attributes: {
    								text: "@dev the clock in time for an account on a given day"
    							},
    							id: 15,
    							name: "StructuredDocumentation",
    							src: "418:56:0"
    						}
    					],
    					id: 19,
    					name: "VariableDeclaration",
    					src: "479:48:0"
    				},
    				{
    					attributes: {
    						constant: false,
    						mutability: "mutable",
    						name: "last_clock_in_day",
    						overrides: null,
    						scope: 213,
    						stateVariable: true,
    						storageLocation: "default",
    						type: "mapping(address => uint16)",
    						value: null,
    						visibility: "private"
    					},
    					children: [
    						{
    							attributes: {
    								type: "mapping(address => uint16)"
    							},
    							children: [
    								{
    									attributes: {
    										name: "address",
    										type: "address"
    									},
    									id: 21,
    									name: "ElementaryTypeName",
    									src: "653:7:0"
    								},
    								{
    									attributes: {
    										name: "uint16",
    										type: "uint16"
    									},
    									id: 22,
    									name: "ElementaryTypeName",
    									src: "664:6:0"
    								}
    							],
    							id: 23,
    							name: "Mapping",
    							src: "644:27:0"
    						},
    						{
    							attributes: {
    								text: "@dev check the last clock out day for working. Used to ensure that only one clock out is done per day"
    							},
    							id: 20,
    							name: "StructuredDocumentation",
    							src: "534:105:0"
    						}
    					],
    					id: 24,
    					name: "VariableDeclaration",
    					src: "644:53:0"
    				},
    				{
    					attributes: {
    						anonymous: false,
    						documentation: null,
    						name: "PayoutMadeEvent"
    					},
    					children: [
    						{
    							children: [
    								{
    									attributes: {
    										constant: false,
    										indexed: false,
    										mutability: "mutable",
    										name: "_to",
    										overrides: null,
    										scope: 30,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "address",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "address",
    												stateMutability: "nonpayable",
    												type: "address"
    											},
    											id: 25,
    											name: "ElementaryTypeName",
    											src: "726:7:0"
    										}
    									],
    									id: 26,
    									name: "VariableDeclaration",
    									src: "726:11:0"
    								},
    								{
    									attributes: {
    										constant: false,
    										indexed: false,
    										mutability: "mutable",
    										name: "value",
    										overrides: null,
    										scope: 30,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "uint256",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "uint",
    												type: "uint256"
    											},
    											id: 27,
    											name: "ElementaryTypeName",
    											src: "739:4:0"
    										}
    									],
    									id: 28,
    									name: "VariableDeclaration",
    									src: "739:10:0"
    								}
    							],
    							id: 29,
    							name: "ParameterList",
    							src: "725:25:0"
    						}
    					],
    					id: 30,
    					name: "EventDefinition",
    					src: "704:47:0"
    				},
    				{
    					attributes: {
    						anonymous: false,
    						documentation: null,
    						name: "ClockInTimeEvent"
    					},
    					children: [
    						{
    							children: [
    								{
    									attributes: {
    										constant: false,
    										indexed: false,
    										mutability: "mutable",
    										name: "user",
    										overrides: null,
    										scope: 36,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "address",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "address",
    												stateMutability: "nonpayable",
    												type: "address"
    											},
    											id: 31,
    											name: "ElementaryTypeName",
    											src: "779:7:0"
    										}
    									],
    									id: 32,
    									name: "VariableDeclaration",
    									src: "779:12:0"
    								},
    								{
    									attributes: {
    										constant: false,
    										indexed: false,
    										mutability: "mutable",
    										name: "timestamp",
    										overrides: null,
    										scope: 36,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "uint256",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "uint",
    												type: "uint256"
    											},
    											id: 33,
    											name: "ElementaryTypeName",
    											src: "793:4:0"
    										}
    									],
    									id: 34,
    									name: "VariableDeclaration",
    									src: "793:14:0"
    								}
    							],
    							id: 35,
    							name: "ParameterList",
    							src: "778:30:0"
    						}
    					],
    					id: 36,
    					name: "EventDefinition",
    					src: "756:53:0"
    				},
    				{
    					attributes: {
    						anonymous: false,
    						documentation: null,
    						name: "ClockOutTimeEvent"
    					},
    					children: [
    						{
    							children: [
    								{
    									attributes: {
    										constant: false,
    										indexed: false,
    										mutability: "mutable",
    										name: "user",
    										overrides: null,
    										scope: 42,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "address",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "address",
    												stateMutability: "nonpayable",
    												type: "address"
    											},
    											id: 37,
    											name: "ElementaryTypeName",
    											src: "838:7:0"
    										}
    									],
    									id: 38,
    									name: "VariableDeclaration",
    									src: "838:12:0"
    								},
    								{
    									attributes: {
    										constant: false,
    										indexed: false,
    										mutability: "mutable",
    										name: "timestamp",
    										overrides: null,
    										scope: 42,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "uint256",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "uint",
    												type: "uint256"
    											},
    											id: 39,
    											name: "ElementaryTypeName",
    											src: "852:4:0"
    										}
    									],
    									id: 40,
    									name: "VariableDeclaration",
    									src: "852:14:0"
    								}
    							],
    							id: 41,
    							name: "ParameterList",
    							src: "837:30:0"
    						}
    					],
    					id: 42,
    					name: "EventDefinition",
    					src: "814:54:0"
    				},
    				{
    					attributes: {
    						documentation: null,
    						implemented: true,
    						isConstructor: true,
    						kind: "constructor",
    						name: "",
    						overrides: null,
    						scope: 213,
    						stateMutability: "nonpayable",
    						virtual: false,
    						visibility: "public"
    					},
    					children: [
    						{
    							children: [
    								{
    									attributes: {
    										constant: false,
    										mutability: "mutable",
    										name: "initialSupply",
    										overrides: null,
    										scope: 69,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "uint256",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "uint256",
    												type: "uint256"
    											},
    											id: 43,
    											name: "ElementaryTypeName",
    											src: "886:7:0"
    										}
    									],
    									id: 44,
    									name: "VariableDeclaration",
    									src: "886:21:0"
    								}
    							],
    							id: 45,
    							name: "ParameterList",
    							src: "885:23:0"
    						},
    						{
    							attributes: {
    								parameters: [
    									null
    								]
    							},
    							children: [
    							],
    							id: 50,
    							name: "ParameterList",
    							src: "934:0:0"
    						},
    						{
    							children: [
    								{
    									attributes: {
    										argumentTypes: null,
    										overloadedDeclarations: [
    											null
    										],
    										referencedDeclaration: 1101,
    										type: "type(contract ERC20)",
    										value: "ERC20"
    									},
    									id: 46,
    									name: "Identifier",
    									src: "909:5:0"
    								},
    								{
    									attributes: {
    										argumentTypes: null,
    										hexvalue: "45766965434f494e",
    										isConstant: false,
    										isLValue: false,
    										isPure: true,
    										lValueRequested: false,
    										subdenomination: null,
    										token: "string",
    										type: "literal_string \"EvieCOIN\"",
    										value: "EvieCOIN"
    									},
    									id: 47,
    									name: "Literal",
    									src: "915:10:0"
    								},
    								{
    									attributes: {
    										argumentTypes: null,
    										hexvalue: "455645",
    										isConstant: false,
    										isLValue: false,
    										isPure: true,
    										lValueRequested: false,
    										subdenomination: null,
    										token: "string",
    										type: "literal_string \"EVE\"",
    										value: "EVE"
    									},
    									id: 48,
    									name: "Literal",
    									src: "927:5:0"
    								}
    							],
    							id: 49,
    							name: "ModifierInvocation",
    							src: "909:24:0"
    						},
    						{
    							children: [
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_address_payable",
    																typeString: "address payable"
    															}
    														],
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 401,
    														type: "function (address)",
    														value: "transferOwnership"
    													},
    													id: 51,
    													name: "Identifier",
    													src: "944:17:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														member_name: "sender",
    														referencedDeclaration: null,
    														type: "address payable"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: -15,
    																type: "msg",
    																value: "msg"
    															},
    															id: 52,
    															name: "Identifier",
    															src: "962:3:0"
    														}
    													],
    													id: 53,
    													name: "MemberAccess",
    													src: "962:10:0"
    												}
    											],
    											id: 54,
    											name: "FunctionCall",
    											src: "944:29:0"
    										}
    									],
    									id: 55,
    									name: "ExpressionStatement",
    									src: "944:29:0"
    								},
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_address_payable",
    																typeString: "address payable"
    															},
    															{
    																typeIdentifier: "t_uint256",
    																typeString: "uint256"
    															}
    														],
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 977,
    														type: "function (address,uint256)",
    														value: "_mint"
    													},
    													id: 56,
    													name: "Identifier",
    													src: "983:5:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														member_name: "sender",
    														referencedDeclaration: null,
    														type: "address payable"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: -15,
    																type: "msg",
    																value: "msg"
    															},
    															id: 57,
    															name: "Identifier",
    															src: "989:3:0"
    														}
    													],
    													id: 58,
    													name: "MemberAccess",
    													src: "989:10:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														commonType: {
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														},
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														operator: "*",
    														type: "uint256"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: 44,
    																type: "uint256",
    																value: "initialSupply"
    															},
    															id: 59,
    															name: "Identifier",
    															src: "1001:13:0"
    														},
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isInlineArray: false,
    																isLValue: false,
    																isPure: false,
    																lValueRequested: false,
    																type: "uint256"
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		commonType: {
    																			typeIdentifier: "t_uint256",
    																			typeString: "uint256"
    																		},
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		lValueRequested: false,
    																		operator: "**",
    																		type: "uint256"
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				hexvalue: "3130",
    																				isConstant: false,
    																				isLValue: false,
    																				isPure: true,
    																				lValueRequested: false,
    																				subdenomination: null,
    																				token: "number",
    																				type: "int_const 10",
    																				value: "10"
    																			},
    																			id: 60,
    																			name: "Literal",
    																			src: "1018:2:0"
    																		},
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				"arguments": [
    																					null
    																				],
    																				isConstant: false,
    																				isLValue: false,
    																				isPure: false,
    																				isStructConstructorCall: false,
    																				lValueRequested: false,
    																				names: [
    																					null
    																				],
    																				tryCall: false,
    																				type: "uint8",
    																				type_conversion: false
    																			},
    																			children: [
    																				{
    																					attributes: {
    																						argumentTypes: [
    																							null
    																						],
    																						overloadedDeclarations: [
    																							null
    																						],
    																						referencedDeclaration: 677,
    																						type: "function () view returns (uint8)",
    																						value: "decimals"
    																					},
    																					id: 61,
    																					name: "Identifier",
    																					src: "1024:8:0"
    																				}
    																			],
    																			id: 62,
    																			name: "FunctionCall",
    																			src: "1024:10:0"
    																		}
    																	],
    																	id: 63,
    																	name: "BinaryOperation",
    																	src: "1018:16:0"
    																}
    															],
    															id: 64,
    															name: "TupleExpression",
    															src: "1017:18:0"
    														}
    													],
    													id: 65,
    													name: "BinaryOperation",
    													src: "1001:34:0"
    												}
    											],
    											id: 66,
    											name: "FunctionCall",
    											src: "983:53:0"
    										}
    									],
    									id: 67,
    									name: "ExpressionStatement",
    									src: "983:53:0"
    								}
    							],
    							id: 68,
    							name: "Block",
    							src: "934:109:0"
    						}
    					],
    					id: 69,
    					name: "FunctionDefinition",
    					src: "874:169:0"
    				},
    				{
    					attributes: {
    						documentation: null,
    						name: "_once_per_day",
    						overrides: null,
    						virtual: false,
    						visibility: "internal"
    					},
    					children: [
    						{
    							attributes: {
    								parameters: [
    									null
    								]
    							},
    							children: [
    							],
    							id: 70,
    							name: "ParameterList",
    							src: "1071:2:0"
    						},
    						{
    							children: [
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_bool",
    																typeString: "bool"
    															}
    														],
    														overloadedDeclarations: [
    															-18,
    															-18
    														],
    														referencedDeclaration: -18,
    														type: "function (bool) pure",
    														value: "require"
    													},
    													id: 71,
    													name: "Identifier",
    													src: "1084:7:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														commonType: {
    															typeIdentifier: "t_uint16",
    															typeString: "uint16"
    														},
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														operator: ">",
    														type: "bool"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isLValue: false,
    																isPure: false,
    																isStructConstructorCall: false,
    																lValueRequested: false,
    																names: [
    																	null
    																],
    																tryCall: false,
    																type: "uint16",
    																type_conversion: true
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: [
    																			{
    																				typeIdentifier: "t_uint256",
    																				typeString: "uint256"
    																			}
    																		],
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: true,
    																		lValueRequested: false,
    																		type: "type(uint16)"
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				name: "uint16",
    																				type: null
    																			},
    																			id: 72,
    																			name: "ElementaryTypeName",
    																			src: "1092:6:0"
    																		}
    																	],
    																	id: 73,
    																	name: "ElementaryTypeNameExpression",
    																	src: "1092:6:0"
    																},
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		isStructConstructorCall: false,
    																		lValueRequested: false,
    																		names: [
    																			null
    																		],
    																		tryCall: false,
    																		type: "uint256",
    																		type_conversion: false
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				argumentTypes: [
    																					{
    																						typeIdentifier: "t_rational_86400_by_1",
    																						typeString: "int_const 86400"
    																					}
    																				],
    																				isConstant: false,
    																				isLValue: false,
    																				isPure: false,
    																				lValueRequested: false,
    																				member_name: "div",
    																				referencedDeclaration: 528,
    																				type: "function (uint256,uint256) pure returns (uint256)"
    																			},
    																			children: [
    																				{
    																					attributes: {
    																						argumentTypes: null,
    																						isConstant: false,
    																						isLValue: false,
    																						isPure: false,
    																						lValueRequested: false,
    																						member_name: "timestamp",
    																						referencedDeclaration: null,
    																						type: "uint256"
    																					},
    																					children: [
    																						{
    																							attributes: {
    																								argumentTypes: null,
    																								overloadedDeclarations: [
    																									null
    																								],
    																								referencedDeclaration: -4,
    																								type: "block",
    																								value: "block"
    																							},
    																							id: 74,
    																							name: "Identifier",
    																							src: "1099:5:0"
    																						}
    																					],
    																					id: 75,
    																					name: "MemberAccess",
    																					src: "1099:15:0"
    																				}
    																			],
    																			id: 76,
    																			name: "MemberAccess",
    																			src: "1099:19:0"
    																		},
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				hexvalue: "31",
    																				isConstant: false,
    																				isLValue: false,
    																				isPure: true,
    																				lValueRequested: false,
    																				subdenomination: "days",
    																				token: "number",
    																				type: "int_const 86400",
    																				value: "1"
    																			},
    																			id: 77,
    																			name: "Literal",
    																			src: "1119:6:0"
    																		}
    																	],
    																	id: 78,
    																	name: "FunctionCall",
    																	src: "1099:27:0"
    																}
    															],
    															id: 79,
    															name: "FunctionCall",
    															src: "1092:35:0"
    														},
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isLValue: true,
    																isPure: false,
    																lValueRequested: false,
    																type: "uint16"
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		overloadedDeclarations: [
    																			null
    																		],
    																		referencedDeclaration: 24,
    																		type: "mapping(address => uint16)",
    																		value: "last_clock_in_day"
    																	},
    																	id: 80,
    																	name: "Identifier",
    																	src: "1131:17:0"
    																},
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		lValueRequested: false,
    																		member_name: "sender",
    																		referencedDeclaration: null,
    																		type: "address payable"
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				overloadedDeclarations: [
    																					null
    																				],
    																				referencedDeclaration: -15,
    																				type: "msg",
    																				value: "msg"
    																			},
    																			id: 81,
    																			name: "Identifier",
    																			src: "1149:3:0"
    																		}
    																	],
    																	id: 82,
    																	name: "MemberAccess",
    																	src: "1149:10:0"
    																}
    															],
    															id: 83,
    															name: "IndexAccess",
    															src: "1131:29:0"
    														}
    													],
    													id: 84,
    													name: "BinaryOperation",
    													src: "1092:68:0"
    												}
    											],
    											id: 85,
    											name: "FunctionCall",
    											src: "1084:77:0"
    										}
    									],
    									id: 86,
    									name: "ExpressionStatement",
    									src: "1084:77:0"
    								},
    								{
    									id: 87,
    									name: "PlaceholderStatement",
    									src: "1171:1:0"
    								}
    							],
    							id: 88,
    							name: "Block",
    							src: "1074:105:0"
    						}
    					],
    					id: 89,
    					name: "ModifierDefinition",
    					src: "1049:130:0"
    				},
    				{
    					attributes: {
    						functionSelector: "a481aada",
    						implemented: true,
    						isConstructor: false,
    						kind: "function",
    						name: "clockStartTime",
    						overrides: null,
    						scope: 213,
    						stateMutability: "nonpayable",
    						virtual: false,
    						visibility: "public"
    					},
    					children: [
    						{
    							attributes: {
    								text: "@dev a user clocks in their start time"
    							},
    							id: 90,
    							name: "StructuredDocumentation",
    							src: "1185:42:0"
    						},
    						{
    							attributes: {
    								parameters: [
    									null
    								]
    							},
    							children: [
    							],
    							id: 91,
    							name: "ParameterList",
    							src: "1255:2:0"
    						},
    						{
    							attributes: {
    								parameters: [
    									null
    								]
    							},
    							children: [
    							],
    							id: 94,
    							name: "ParameterList",
    							src: "1279:0:0"
    						},
    						{
    							attributes: {
    								"arguments": null
    							},
    							children: [
    								{
    									attributes: {
    										argumentTypes: null,
    										overloadedDeclarations: [
    											null
    										],
    										referencedDeclaration: 89,
    										type: "modifier ()",
    										value: "_once_per_day"
    									},
    									id: 92,
    									name: "Identifier",
    									src: "1265:13:0"
    								}
    							],
    							id: 93,
    							name: "ModifierInvocation",
    							src: "1265:13:0"
    						},
    						{
    							children: [
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												lValueRequested: false,
    												operator: "=",
    												type: "uint256"
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: true,
    														isPure: false,
    														lValueRequested: true,
    														type: "uint256"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: 19,
    																type: "mapping(address => uint256)",
    																value: "clock_in_times"
    															},
    															id: 95,
    															name: "Identifier",
    															src: "1289:14:0"
    														},
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isLValue: false,
    																isPure: false,
    																lValueRequested: false,
    																member_name: "sender",
    																referencedDeclaration: null,
    																type: "address payable"
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		overloadedDeclarations: [
    																			null
    																		],
    																		referencedDeclaration: -15,
    																		type: "msg",
    																		value: "msg"
    																	},
    																	id: 96,
    																	name: "Identifier",
    																	src: "1304:3:0"
    																}
    															],
    															id: 97,
    															name: "MemberAccess",
    															src: "1304:10:0"
    														}
    													],
    													id: 98,
    													name: "IndexAccess",
    													src: "1289:26:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														member_name: "timestamp",
    														referencedDeclaration: null,
    														type: "uint256"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: -4,
    																type: "block",
    																value: "block"
    															},
    															id: 99,
    															name: "Identifier",
    															src: "1318:5:0"
    														}
    													],
    													id: 100,
    													name: "MemberAccess",
    													src: "1318:15:0"
    												}
    											],
    											id: 101,
    											name: "Assignment",
    											src: "1289:44:0"
    										}
    									],
    									id: 102,
    									name: "ExpressionStatement",
    									src: "1289:44:0"
    								},
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												lValueRequested: false,
    												operator: "=",
    												type: "uint16"
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: true,
    														isPure: false,
    														lValueRequested: true,
    														type: "uint16"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: 24,
    																type: "mapping(address => uint16)",
    																value: "last_clock_in_day"
    															},
    															id: 103,
    															name: "Identifier",
    															src: "1343:17:0"
    														},
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isLValue: false,
    																isPure: false,
    																lValueRequested: false,
    																member_name: "sender",
    																referencedDeclaration: null,
    																type: "address payable"
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		overloadedDeclarations: [
    																			null
    																		],
    																		referencedDeclaration: -15,
    																		type: "msg",
    																		value: "msg"
    																	},
    																	id: 104,
    																	name: "Identifier",
    																	src: "1361:3:0"
    																}
    															],
    															id: 105,
    															name: "MemberAccess",
    															src: "1361:10:0"
    														}
    													],
    													id: 106,
    													name: "IndexAccess",
    													src: "1343:29:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														isStructConstructorCall: false,
    														lValueRequested: false,
    														names: [
    															null
    														],
    														tryCall: false,
    														type: "uint16",
    														type_conversion: true
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: [
    																	{
    																		typeIdentifier: "t_uint256",
    																		typeString: "uint256"
    																	}
    																],
    																isConstant: false,
    																isLValue: false,
    																isPure: true,
    																lValueRequested: false,
    																type: "type(uint16)"
    															},
    															children: [
    																{
    																	attributes: {
    																		name: "uint16",
    																		type: null
    																	},
    																	id: 107,
    																	name: "ElementaryTypeName",
    																	src: "1375:6:0"
    																}
    															],
    															id: 108,
    															name: "ElementaryTypeNameExpression",
    															src: "1375:6:0"
    														},
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isLValue: false,
    																isPure: false,
    																isStructConstructorCall: false,
    																lValueRequested: false,
    																names: [
    																	null
    																],
    																tryCall: false,
    																type: "uint256",
    																type_conversion: false
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: [
    																			{
    																				typeIdentifier: "t_rational_86400_by_1",
    																				typeString: "int_const 86400"
    																			}
    																		],
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		lValueRequested: false,
    																		member_name: "div",
    																		referencedDeclaration: 528,
    																		type: "function (uint256,uint256) pure returns (uint256)"
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				isConstant: false,
    																				isLValue: false,
    																				isPure: false,
    																				lValueRequested: false,
    																				member_name: "timestamp",
    																				referencedDeclaration: null,
    																				type: "uint256"
    																			},
    																			children: [
    																				{
    																					attributes: {
    																						argumentTypes: null,
    																						overloadedDeclarations: [
    																							null
    																						],
    																						referencedDeclaration: -4,
    																						type: "block",
    																						value: "block"
    																					},
    																					id: 109,
    																					name: "Identifier",
    																					src: "1382:5:0"
    																				}
    																			],
    																			id: 110,
    																			name: "MemberAccess",
    																			src: "1382:15:0"
    																		}
    																	],
    																	id: 111,
    																	name: "MemberAccess",
    																	src: "1382:19:0"
    																},
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		hexvalue: "31",
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: true,
    																		lValueRequested: false,
    																		subdenomination: "days",
    																		token: "number",
    																		type: "int_const 86400",
    																		value: "1"
    																	},
    																	id: 112,
    																	name: "Literal",
    																	src: "1402:6:0"
    																}
    															],
    															id: 113,
    															name: "FunctionCall",
    															src: "1382:27:0"
    														}
    													],
    													id: 114,
    													name: "FunctionCall",
    													src: "1375:35:0"
    												}
    											],
    											id: 115,
    											name: "Assignment",
    											src: "1343:67:0"
    										}
    									],
    									id: 116,
    									name: "ExpressionStatement",
    									src: "1343:67:0"
    								},
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: true,
    												isPure: false,
    												lValueRequested: false,
    												type: "uint256"
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: null,
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 19,
    														type: "mapping(address => uint256)",
    														value: "clock_in_times"
    													},
    													id: 117,
    													name: "Identifier",
    													src: "1420:14:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														member_name: "sender",
    														referencedDeclaration: null,
    														type: "address payable"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: -15,
    																type: "msg",
    																value: "msg"
    															},
    															id: 118,
    															name: "Identifier",
    															src: "1435:3:0"
    														}
    													],
    													id: 119,
    													name: "MemberAccess",
    													src: "1435:10:0"
    												}
    											],
    											id: 120,
    											name: "IndexAccess",
    											src: "1420:26:0"
    										}
    									],
    									id: 121,
    									name: "ExpressionStatement",
    									src: "1420:26:0"
    								},
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_address_payable",
    																typeString: "address payable"
    															},
    															{
    																typeIdentifier: "t_uint256",
    																typeString: "uint256"
    															}
    														],
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 36,
    														type: "function (address,uint256)",
    														value: "ClockInTimeEvent"
    													},
    													id: 122,
    													name: "Identifier",
    													src: "1461:16:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														member_name: "sender",
    														referencedDeclaration: null,
    														type: "address payable"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: -15,
    																type: "msg",
    																value: "msg"
    															},
    															id: 123,
    															name: "Identifier",
    															src: "1478:3:0"
    														}
    													],
    													id: 124,
    													name: "MemberAccess",
    													src: "1478:10:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														member_name: "timestamp",
    														referencedDeclaration: null,
    														type: "uint256"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: -4,
    																type: "block",
    																value: "block"
    															},
    															id: 125,
    															name: "Identifier",
    															src: "1490:5:0"
    														}
    													],
    													id: 126,
    													name: "MemberAccess",
    													src: "1490:15:0"
    												}
    											],
    											id: 127,
    											name: "FunctionCall",
    											src: "1461:45:0"
    										}
    									],
    									id: 128,
    									name: "EmitStatement",
    									src: "1456:50:0"
    								}
    							],
    							id: 129,
    							name: "Block",
    							src: "1279:234:0"
    						}
    					],
    					id: 130,
    					name: "FunctionDefinition",
    					src: "1232:281:0"
    				},
    				{
    					attributes: {
    						documentation: null,
    						functionSelector: "b939df59",
    						implemented: true,
    						isConstructor: false,
    						kind: "function",
    						modifiers: [
    							null
    						],
    						name: "clockEndTime",
    						overrides: null,
    						scope: 213,
    						stateMutability: "nonpayable",
    						virtual: false,
    						visibility: "public"
    					},
    					children: [
    						{
    							attributes: {
    								parameters: [
    									null
    								]
    							},
    							children: [
    							],
    							id: 131,
    							name: "ParameterList",
    							src: "1586:2:0"
    						},
    						{
    							attributes: {
    								parameters: [
    									null
    								]
    							},
    							children: [
    							],
    							id: 132,
    							name: "ParameterList",
    							src: "1596:0:0"
    						},
    						{
    							children: [
    								{
    									attributes: {
    										assignments: [
    											134
    										]
    									},
    									children: [
    										{
    											attributes: {
    												constant: false,
    												mutability: "mutable",
    												name: "end_time",
    												overrides: null,
    												scope: 177,
    												stateVariable: false,
    												storageLocation: "default",
    												type: "uint256",
    												value: null,
    												visibility: "internal"
    											},
    											children: [
    												{
    													attributes: {
    														name: "uint",
    														type: "uint256"
    													},
    													id: 133,
    													name: "ElementaryTypeName",
    													src: "1606:4:0"
    												}
    											],
    											id: 134,
    											name: "VariableDeclaration",
    											src: "1606:13:0"
    										},
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												lValueRequested: false,
    												member_name: "timestamp",
    												referencedDeclaration: null,
    												type: "uint256"
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: null,
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: -4,
    														type: "block",
    														value: "block"
    													},
    													id: 135,
    													name: "Identifier",
    													src: "1622:5:0"
    												}
    											],
    											id: 136,
    											name: "MemberAccess",
    											src: "1622:15:0"
    										}
    									],
    									id: 137,
    									name: "VariableDeclarationStatement",
    									src: "1606:31:0"
    								},
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_bool",
    																typeString: "bool"
    															}
    														],
    														overloadedDeclarations: [
    															-18,
    															-18
    														],
    														referencedDeclaration: -18,
    														type: "function (bool) pure",
    														value: "require"
    													},
    													id: 138,
    													name: "Identifier",
    													src: "1647:7:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														commonType: {
    															typeIdentifier: "t_uint256",
    															typeString: "uint256"
    														},
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														operator: ">=",
    														type: "bool"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: 134,
    																type: "uint256",
    																value: "end_time"
    															},
    															id: 139,
    															name: "Identifier",
    															src: "1655:8:0"
    														},
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isLValue: true,
    																isPure: false,
    																lValueRequested: false,
    																type: "uint256"
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		overloadedDeclarations: [
    																			null
    																		],
    																		referencedDeclaration: 19,
    																		type: "mapping(address => uint256)",
    																		value: "clock_in_times"
    																	},
    																	id: 140,
    																	name: "Identifier",
    																	src: "1667:14:0"
    																},
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		lValueRequested: false,
    																		member_name: "sender",
    																		referencedDeclaration: null,
    																		type: "address payable"
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				overloadedDeclarations: [
    																					null
    																				],
    																				referencedDeclaration: -15,
    																				type: "msg",
    																				value: "msg"
    																			},
    																			id: 141,
    																			name: "Identifier",
    																			src: "1682:3:0"
    																		}
    																	],
    																	id: 142,
    																	name: "MemberAccess",
    																	src: "1682:10:0"
    																}
    															],
    															id: 143,
    															name: "IndexAccess",
    															src: "1667:26:0"
    														}
    													],
    													id: 144,
    													name: "BinaryOperation",
    													src: "1655:38:0"
    												}
    											],
    											id: 145,
    											name: "FunctionCall",
    											src: "1647:47:0"
    										}
    									],
    									id: 146,
    									name: "ExpressionStatement",
    									src: "1647:47:0"
    								},
    								{
    									attributes: {
    										falseBody: null
    									},
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												commonType: {
    													typeIdentifier: "t_uint256",
    													typeString: "uint256"
    												},
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												lValueRequested: false,
    												operator: "<=",
    												type: "bool"
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														isStructConstructorCall: false,
    														lValueRequested: false,
    														names: [
    															null
    														],
    														tryCall: false,
    														type: "uint256",
    														type_conversion: false
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: [
    																	{
    																		typeIdentifier: "t_uint256",
    																		typeString: "uint256"
    																	}
    																],
    																isConstant: false,
    																isLValue: false,
    																isPure: false,
    																lValueRequested: false,
    																member_name: "sub",
    																referencedDeclaration: 448,
    																type: "function (uint256,uint256) pure returns (uint256)"
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		overloadedDeclarations: [
    																			null
    																		],
    																		referencedDeclaration: 134,
    																		type: "uint256",
    																		value: "end_time"
    																	},
    																	id: 147,
    																	name: "Identifier",
    																	src: "1708:8:0"
    																}
    															],
    															id: 148,
    															name: "MemberAccess",
    															src: "1708:12:0"
    														},
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isLValue: true,
    																isPure: false,
    																lValueRequested: false,
    																type: "uint256"
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		overloadedDeclarations: [
    																			null
    																		],
    																		referencedDeclaration: 19,
    																		type: "mapping(address => uint256)",
    																		value: "clock_in_times"
    																	},
    																	id: 149,
    																	name: "Identifier",
    																	src: "1721:14:0"
    																},
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		lValueRequested: false,
    																		member_name: "sender",
    																		referencedDeclaration: null,
    																		type: "address payable"
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				overloadedDeclarations: [
    																					null
    																				],
    																				referencedDeclaration: -15,
    																				type: "msg",
    																				value: "msg"
    																			},
    																			id: 150,
    																			name: "Identifier",
    																			src: "1736:3:0"
    																		}
    																	],
    																	id: 151,
    																	name: "MemberAccess",
    																	src: "1736:10:0"
    																}
    															],
    															id: 152,
    															name: "IndexAccess",
    															src: "1721:26:0"
    														}
    													],
    													id: 153,
    													name: "FunctionCall",
    													src: "1708:40:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														hexvalue: "31",
    														isConstant: false,
    														isLValue: false,
    														isPure: true,
    														lValueRequested: false,
    														subdenomination: "hours",
    														token: "number",
    														type: "int_const 3600",
    														value: "1"
    													},
    													id: 154,
    													name: "Literal",
    													src: "1752:7:0"
    												}
    											],
    											id: 155,
    											name: "BinaryOperation",
    											src: "1708:51:0"
    										},
    										{
    											children: [
    												{
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																isConstant: false,
    																isLValue: false,
    																isPure: false,
    																isStructConstructorCall: false,
    																lValueRequested: false,
    																names: [
    																	null
    																],
    																tryCall: false,
    																type: "tuple()",
    																type_conversion: false
    															},
    															children: [
    																{
    																	attributes: {
    																		argumentTypes: [
    																			{
    																				typeIdentifier: "t_address_payable",
    																				typeString: "address payable"
    																			},
    																			{
    																				typeIdentifier: "t_uint256",
    																				typeString: "uint256"
    																			}
    																		],
    																		overloadedDeclarations: [
    																			null
    																		],
    																		referencedDeclaration: 212,
    																		type: "function (address,uint256)",
    																		value: "_payout"
    																	},
    																	id: 156,
    																	name: "Identifier",
    																	src: "1811:7:0"
    																},
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		lValueRequested: false,
    																		member_name: "sender",
    																		referencedDeclaration: null,
    																		type: "address payable"
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				overloadedDeclarations: [
    																					null
    																				],
    																				referencedDeclaration: -15,
    																				type: "msg",
    																				value: "msg"
    																			},
    																			id: 157,
    																			name: "Identifier",
    																			src: "1819:3:0"
    																		}
    																	],
    																	id: 158,
    																	name: "MemberAccess",
    																	src: "1819:10:0"
    																},
    																{
    																	attributes: {
    																		argumentTypes: null,
    																		commonType: {
    																			typeIdentifier: "t_uint256",
    																			typeString: "uint256"
    																		},
    																		isConstant: false,
    																		isLValue: false,
    																		isPure: false,
    																		lValueRequested: false,
    																		operator: "*",
    																		type: "uint256"
    																	},
    																	children: [
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				hexvalue: "31",
    																				isConstant: false,
    																				isLValue: false,
    																				isPure: true,
    																				lValueRequested: false,
    																				subdenomination: null,
    																				token: "number",
    																				type: "int_const 1",
    																				value: "1"
    																			},
    																			id: 159,
    																			name: "Literal",
    																			src: "1831:1:0"
    																		},
    																		{
    																			attributes: {
    																				argumentTypes: null,
    																				isConstant: false,
    																				isInlineArray: false,
    																				isLValue: false,
    																				isPure: false,
    																				lValueRequested: false,
    																				type: "uint256"
    																			},
    																			children: [
    																				{
    																					attributes: {
    																						argumentTypes: null,
    																						commonType: {
    																							typeIdentifier: "t_uint256",
    																							typeString: "uint256"
    																						},
    																						isConstant: false,
    																						isLValue: false,
    																						isPure: false,
    																						lValueRequested: false,
    																						operator: "**",
    																						type: "uint256"
    																					},
    																					children: [
    																						{
    																							attributes: {
    																								argumentTypes: null,
    																								hexvalue: "3130",
    																								isConstant: false,
    																								isLValue: false,
    																								isPure: true,
    																								lValueRequested: false,
    																								subdenomination: null,
    																								token: "number",
    																								type: "int_const 10",
    																								value: "10"
    																							},
    																							id: 160,
    																							name: "Literal",
    																							src: "1836:2:0"
    																						},
    																						{
    																							attributes: {
    																								argumentTypes: null,
    																								"arguments": [
    																									null
    																								],
    																								isConstant: false,
    																								isLValue: false,
    																								isPure: false,
    																								isStructConstructorCall: false,
    																								lValueRequested: false,
    																								names: [
    																									null
    																								],
    																								tryCall: false,
    																								type: "uint8",
    																								type_conversion: false
    																							},
    																							children: [
    																								{
    																									attributes: {
    																										argumentTypes: [
    																											null
    																										],
    																										overloadedDeclarations: [
    																											null
    																										],
    																										referencedDeclaration: 677,
    																										type: "function () view returns (uint8)",
    																										value: "decimals"
    																									},
    																									id: 161,
    																									name: "Identifier",
    																									src: "1842:8:0"
    																								}
    																							],
    																							id: 162,
    																							name: "FunctionCall",
    																							src: "1842:10:0"
    																						}
    																					],
    																					id: 163,
    																					name: "BinaryOperation",
    																					src: "1836:16:0"
    																				}
    																			],
    																			id: 164,
    																			name: "TupleExpression",
    																			src: "1835:18:0"
    																		}
    																	],
    																	id: 165,
    																	name: "BinaryOperation",
    																	src: "1831:22:0"
    																}
    															],
    															id: 166,
    															name: "FunctionCall",
    															src: "1811:43:0"
    														}
    													],
    													id: 167,
    													name: "ExpressionStatement",
    													src: "1811:43:0"
    												}
    											],
    											id: 168,
    											name: "Block",
    											src: "1761:104:0"
    										}
    									],
    									id: 169,
    									name: "IfStatement",
    									src: "1704:161:0"
    								},
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_address_payable",
    																typeString: "address payable"
    															},
    															{
    																typeIdentifier: "t_uint256",
    																typeString: "uint256"
    															}
    														],
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 36,
    														type: "function (address,uint256)",
    														value: "ClockInTimeEvent"
    													},
    													id: 170,
    													name: "Identifier",
    													src: "1879:16:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														member_name: "sender",
    														referencedDeclaration: null,
    														type: "address payable"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: -15,
    																type: "msg",
    																value: "msg"
    															},
    															id: 171,
    															name: "Identifier",
    															src: "1896:3:0"
    														}
    													],
    													id: 172,
    													name: "MemberAccess",
    													src: "1896:10:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														lValueRequested: false,
    														member_name: "timestamp",
    														referencedDeclaration: null,
    														type: "uint256"
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: null,
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: -4,
    																type: "block",
    																value: "block"
    															},
    															id: 173,
    															name: "Identifier",
    															src: "1908:5:0"
    														}
    													],
    													id: 174,
    													name: "MemberAccess",
    													src: "1908:15:0"
    												}
    											],
    											id: 175,
    											name: "FunctionCall",
    											src: "1879:45:0"
    										}
    									],
    									id: 176,
    									name: "EmitStatement",
    									src: "1874:50:0"
    								}
    							],
    							id: 177,
    							name: "Block",
    							src: "1596:335:0"
    						}
    					],
    					id: 178,
    					name: "FunctionDefinition",
    					src: "1565:366:0"
    				},
    				{
    					attributes: {
    						documentation: null,
    						functionSelector: "5a9ece24",
    						implemented: true,
    						isConstructor: false,
    						kind: "function",
    						name: "mint_new",
    						overrides: null,
    						scope: 213,
    						stateMutability: "nonpayable",
    						virtual: false,
    						visibility: "public"
    					},
    					children: [
    						{
    							children: [
    								{
    									attributes: {
    										constant: false,
    										mutability: "mutable",
    										name: "amount",
    										overrides: null,
    										scope: 192,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "uint256",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "uint",
    												type: "uint256"
    											},
    											id: 179,
    											name: "ElementaryTypeName",
    											src: "1955:4:0"
    										}
    									],
    									id: 180,
    									name: "VariableDeclaration",
    									src: "1955:11:0"
    								}
    							],
    							id: 181,
    							name: "ParameterList",
    							src: "1954:13:0"
    						},
    						{
    							attributes: {
    								parameters: [
    									null
    								]
    							},
    							children: [
    							],
    							id: 184,
    							name: "ParameterList",
    							src: "1985:0:0"
    						},
    						{
    							attributes: {
    								"arguments": null
    							},
    							children: [
    								{
    									attributes: {
    										argumentTypes: null,
    										overloadedDeclarations: [
    											null
    										],
    										referencedDeclaration: 351,
    										type: "modifier ()",
    										value: "onlyOwner"
    									},
    									id: 182,
    									name: "Identifier",
    									src: "1975:9:0"
    								}
    							],
    							id: 183,
    							name: "ModifierInvocation",
    							src: "1975:9:0"
    						},
    						{
    							children: [
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_address",
    																typeString: "address"
    															},
    															{
    																typeIdentifier: "t_uint256",
    																typeString: "uint256"
    															}
    														],
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 977,
    														type: "function (address,uint256)",
    														value: "_mint"
    													},
    													id: 185,
    													name: "Identifier",
    													src: "1995:5:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														"arguments": [
    															null
    														],
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														isStructConstructorCall: false,
    														lValueRequested: false,
    														names: [
    															null
    														],
    														tryCall: false,
    														type: "address",
    														type_conversion: false
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: [
    																	null
    																],
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: 338,
    																type: "function () view returns (address)",
    																value: "owner"
    															},
    															id: 186,
    															name: "Identifier",
    															src: "2001:5:0"
    														}
    													],
    													id: 187,
    													name: "FunctionCall",
    													src: "2001:7:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 180,
    														type: "uint256",
    														value: "amount"
    													},
    													id: 188,
    													name: "Identifier",
    													src: "2010:6:0"
    												}
    											],
    											id: 189,
    											name: "FunctionCall",
    											src: "1995:22:0"
    										}
    									],
    									id: 190,
    									name: "ExpressionStatement",
    									src: "1995:22:0"
    								}
    							],
    							id: 191,
    							name: "Block",
    							src: "1985:39:0"
    						}
    					],
    					id: 192,
    					name: "FunctionDefinition",
    					src: "1937:87:0"
    				},
    				{
    					attributes: {
    						documentation: null,
    						implemented: true,
    						isConstructor: false,
    						kind: "function",
    						modifiers: [
    							null
    						],
    						name: "_payout",
    						overrides: null,
    						scope: 213,
    						stateMutability: "nonpayable",
    						virtual: false,
    						visibility: "private"
    					},
    					children: [
    						{
    							children: [
    								{
    									attributes: {
    										constant: false,
    										mutability: "mutable",
    										name: "_to",
    										overrides: null,
    										scope: 212,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "address",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "address",
    												stateMutability: "nonpayable",
    												type: "address"
    											},
    											id: 193,
    											name: "ElementaryTypeName",
    											src: "2047:7:0"
    										}
    									],
    									id: 194,
    									name: "VariableDeclaration",
    									src: "2047:11:0"
    								},
    								{
    									attributes: {
    										constant: false,
    										mutability: "mutable",
    										name: "reward_val",
    										overrides: null,
    										scope: 212,
    										stateVariable: false,
    										storageLocation: "default",
    										type: "uint256",
    										value: null,
    										visibility: "internal"
    									},
    									children: [
    										{
    											attributes: {
    												name: "uint",
    												type: "uint256"
    											},
    											id: 195,
    											name: "ElementaryTypeName",
    											src: "2060:4:0"
    										}
    									],
    									id: 196,
    									name: "VariableDeclaration",
    									src: "2060:15:0"
    								}
    							],
    							id: 197,
    							name: "ParameterList",
    							src: "2046:30:0"
    						},
    						{
    							attributes: {
    								parameters: [
    									null
    								]
    							},
    							children: [
    							],
    							id: 198,
    							name: "ParameterList",
    							src: "2085:0:0"
    						},
    						{
    							children: [
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_address",
    																typeString: "address"
    															},
    															{
    																typeIdentifier: "t_address",
    																typeString: "address"
    															},
    															{
    																typeIdentifier: "t_uint256",
    																typeString: "uint256"
    															}
    														],
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 922,
    														type: "function (address,address,uint256)",
    														value: "_transfer"
    													},
    													id: 199,
    													name: "Identifier",
    													src: "2095:9:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														"arguments": [
    															null
    														],
    														isConstant: false,
    														isLValue: false,
    														isPure: false,
    														isStructConstructorCall: false,
    														lValueRequested: false,
    														names: [
    															null
    														],
    														tryCall: false,
    														type: "address",
    														type_conversion: false
    													},
    													children: [
    														{
    															attributes: {
    																argumentTypes: [
    																	null
    																],
    																overloadedDeclarations: [
    																	null
    																],
    																referencedDeclaration: 338,
    																type: "function () view returns (address)",
    																value: "owner"
    															},
    															id: 200,
    															name: "Identifier",
    															src: "2105:5:0"
    														}
    													],
    													id: 201,
    													name: "FunctionCall",
    													src: "2105:7:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 194,
    														type: "address",
    														value: "_to"
    													},
    													id: 202,
    													name: "Identifier",
    													src: "2114:3:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 196,
    														type: "uint256",
    														value: "reward_val"
    													},
    													id: 203,
    													name: "Identifier",
    													src: "2119:10:0"
    												}
    											],
    											id: 204,
    											name: "FunctionCall",
    											src: "2095:35:0"
    										}
    									],
    									id: 205,
    									name: "ExpressionStatement",
    									src: "2095:35:0"
    								},
    								{
    									children: [
    										{
    											attributes: {
    												argumentTypes: null,
    												isConstant: false,
    												isLValue: false,
    												isPure: false,
    												isStructConstructorCall: false,
    												lValueRequested: false,
    												names: [
    													null
    												],
    												tryCall: false,
    												type: "tuple()",
    												type_conversion: false
    											},
    											children: [
    												{
    													attributes: {
    														argumentTypes: [
    															{
    																typeIdentifier: "t_address",
    																typeString: "address"
    															},
    															{
    																typeIdentifier: "t_uint256",
    																typeString: "uint256"
    															}
    														],
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 30,
    														type: "function (address,uint256)",
    														value: "PayoutMadeEvent"
    													},
    													id: 206,
    													name: "Identifier",
    													src: "2145:15:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 194,
    														type: "address",
    														value: "_to"
    													},
    													id: 207,
    													name: "Identifier",
    													src: "2161:3:0"
    												},
    												{
    													attributes: {
    														argumentTypes: null,
    														overloadedDeclarations: [
    															null
    														],
    														referencedDeclaration: 196,
    														type: "uint256",
    														value: "reward_val"
    													},
    													id: 208,
    													name: "Identifier",
    													src: "2166:10:0"
    												}
    											],
    											id: 209,
    											name: "FunctionCall",
    											src: "2145:32:0"
    										}
    									],
    									id: 210,
    									name: "EmitStatement",
    									src: "2140:37:0"
    								}
    							],
    							id: 211,
    							name: "Block",
    							src: "2085:99:0"
    						}
    					],
    					id: 212,
    					name: "FunctionDefinition",
    					src: "2030:154:0"
    				}
    			],
    			id: 213,
    			name: "ContractDefinition",
    			src: "314:1872:0"
    		}
    	],
    	id: 214,
    	name: "SourceUnit",
    	src: "0:2187:0"
    };
    var compiler = {
    	name: "solc",
    	version: "0.7.0+commit.9e61f92b.Emscripten.clang"
    };
    var networks = {
    	"5777": {
    		events: {
    			"0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": {
    				anonymous: false,
    				inputs: [
    					{
    						indexed: true,
    						internalType: "address",
    						name: "owner",
    						type: "address"
    					},
    					{
    						indexed: true,
    						internalType: "address",
    						name: "spender",
    						type: "address"
    					},
    					{
    						indexed: false,
    						internalType: "uint256",
    						name: "value",
    						type: "uint256"
    					}
    				],
    				name: "Approval",
    				type: "event"
    			},
    			"0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0": {
    				anonymous: false,
    				inputs: [
    					{
    						indexed: true,
    						internalType: "address",
    						name: "previousOwner",
    						type: "address"
    					},
    					{
    						indexed: true,
    						internalType: "address",
    						name: "newOwner",
    						type: "address"
    					}
    				],
    				name: "OwnershipTransferred",
    				type: "event"
    			},
    			"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": {
    				anonymous: false,
    				inputs: [
    					{
    						indexed: true,
    						internalType: "address",
    						name: "from",
    						type: "address"
    					},
    					{
    						indexed: true,
    						internalType: "address",
    						name: "to",
    						type: "address"
    					},
    					{
    						indexed: false,
    						internalType: "uint256",
    						name: "value",
    						type: "uint256"
    					}
    				],
    				name: "Transfer",
    				type: "event"
    			},
    			"0x206f9d86997f19b3edba08c74d5d6c53f9b51edccccfbc4b826afe94403e8594": {
    				anonymous: false,
    				inputs: [
    					{
    						indexed: false,
    						internalType: "address",
    						name: "_to",
    						type: "address"
    					},
    					{
    						indexed: false,
    						internalType: "uint256",
    						name: "value",
    						type: "uint256"
    					}
    				],
    				name: "PayoutMadeEvent",
    				type: "event"
    			},
    			"0xd43639c22edfa44378754c6d9b9b75b749d1512256727b73d99ba6f758ad2817": {
    				anonymous: false,
    				inputs: [
    					{
    						indexed: false,
    						internalType: "address",
    						name: "user",
    						type: "address"
    					},
    					{
    						indexed: false,
    						internalType: "uint256",
    						name: "timestamp",
    						type: "uint256"
    					}
    				],
    				name: "ClockInTimeEvent",
    				type: "event"
    			},
    			"0xd6d4a83c50f8452f78f64b946692a111c56aa380e4e5f2a42deff2e69a03ba9a": {
    				anonymous: false,
    				inputs: [
    					{
    						indexed: false,
    						internalType: "address",
    						name: "user",
    						type: "address"
    					},
    					{
    						indexed: false,
    						internalType: "uint256",
    						name: "timestamp",
    						type: "uint256"
    					}
    				],
    				name: "ClockOutTimeEvent",
    				type: "event"
    			}
    		},
    		links: {
    		},
    		address: "0x78E8da6A7123F943754CF5d9e769C15bd6F0692b",
    		transactionHash: "0xddebc9687a141c7df2e3c35a93c04022d523d997e65866e89c210dc4ba318a74"
    	}
    };
    var schemaVersion = "3.3.3";
    var updatedAt = "2021-01-17T14:13:01.159Z";
    var networkType = "ethereum";
    var devdoc = {
    	kind: "dev",
    	methods: {
    		"allowance(address,address)": {
    			details: "See {IERC20-allowance}."
    		},
    		"approve(address,uint256)": {
    			details: "See {IERC20-approve}. Requirements: - `spender` cannot be the zero address."
    		},
    		"balanceOf(address)": {
    			details: "See {IERC20-balanceOf}."
    		},
    		"clockStartTime()": {
    			details: "a user clocks in their start time"
    		},
    		"decimals()": {
    			details: "Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5,05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is called. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}."
    		},
    		"decreaseAllowance(address,uint256)": {
    			details: "Atomically decreases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address. - `spender` must have allowance for the caller of at least `subtractedValue`."
    		},
    		"increaseAllowance(address,uint256)": {
    			details: "Atomically increases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address."
    		},
    		"name()": {
    			details: "Returns the name of the token."
    		},
    		"owner()": {
    			details: "Returns the address of the current owner."
    		},
    		"renounceOwnership()": {
    			details: "Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner."
    		},
    		"symbol()": {
    			details: "Returns the symbol of the token, usually a shorter version of the name."
    		},
    		"totalSupply()": {
    			details: "See {IERC20-totalSupply}."
    		},
    		"transfer(address,uint256)": {
    			details: "See {IERC20-transfer}. Requirements: - `recipient` cannot be the zero address. - the caller must have a balance of at least `amount`."
    		},
    		"transferFrom(address,address,uint256)": {
    			details: "See {IERC20-transferFrom}. Emits an {Approval} event indicating the updated allowance. This is not required by the EIP. See the note at the beginning of {ERC20}. Requirements: - `sender` and `recipient` cannot be the zero address. - `sender` must have a balance of at least `amount`. - the caller must have allowance for ``sender``'s tokens of at least `amount`."
    		},
    		"transferOwnership(address)": {
    			details: "Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner."
    		}
    	},
    	stateVariables: {
    		clock_in_times: {
    			details: "the clock in time for an account on a given day"
    		},
    		last_clock_in_day: {
    			details: "check the last clock out day for working. Used to ensure that only one clock out is done per day"
    		}
    	},
    	version: 1
    };
    var userdoc = {
    	kind: "user",
    	methods: {
    	},
    	version: 1
    };
    var EvieCoinContract = {
    	contractName: contractName,
    	abi: abi,
    	metadata: metadata,
    	bytecode: bytecode,
    	deployedBytecode: deployedBytecode,
    	immutableReferences: immutableReferences,
    	sourceMap: sourceMap,
    	deployedSourceMap: deployedSourceMap,
    	source: source,
    	sourcePath: sourcePath,
    	ast: ast,
    	legacyAST: legacyAST,
    	compiler: compiler,
    	networks: networks,
    	schemaVersion: schemaVersion,
    	updatedAt: updatedAt,
    	networkType: networkType,
    	devdoc: devdoc,
    	userdoc: userdoc
    };

    function ethTimestampToDate(timestamp) {
        return new Date(parseInt(timestamp) * 1000);
    }

    function wrapper(f) {
        return (err, event) => {
            if (err) {
                console.error("Event Listener failed at function", f.name, "due to", err);
            }
            else {
                f(event);
            }
        };
    }
    function _clockInListener(event) {
        const { timestamp } = event.returnValues;
        let startTime = ethTimestampToDate(timestamp);
        UserInfoWriteable.update((u) => {
            return Object.assign(Object.assign({}, u), { startTime });
        });
    }
    const clockInListener = wrapper(_clockInListener);
    const clockOutListener = wrapper(_clockInListener);

    const APIWriteable = writable({
        EvieCoin: undefined,
        address: "",
    });
    const UserInfoWriteable = writable({});
    const APIStore = {
        subscribe: APIWriteable.subscribe,
    };
    const UserInfoStore = {
        subscribe: UserInfoWriteable.subscribe,
    };
    async function initEvieCoin(web3) {
        await loadBlockchainData(web3);
    }
    APIWriteable.subscribe(async (api) => {
        if (api.EvieCoin) {
            await setEventListeners(api.EvieCoin, api.address);
            const proms = [
                loadInitClockIn(api.EvieCoin, api.address),
                loadInitClockOut(api.EvieCoin, api.address),
            ];
            await Promise.all(proms);
        }
    });
    async function loadBlockchainData(web3) {
        const accounts = (await window.ethereum.send("eth_requestAccounts")).result;
        const networkId = await window.web3.eth.net.getId();
        const evieCoinData = EvieCoinContract.networks[networkId];
        let evieCoin;
        if (evieCoinData) {
            evieCoin = new web3.eth.Contract(EvieCoinContract.abi, evieCoinData.address);
            APIWriteable.set({
                EvieCoin: evieCoin,
                address: accounts[0],
            });
            const bal = await evieCoin.methods.balanceOf(accounts[0]).call();
            UserInfoWriteable.update((u) => {
                return Object.assign(Object.assign({}, u), { address: accounts[0], bal });
            });
        }
        else {
            window.alert("Evie Coin contract not deployed to detected network.");
            throw "Evie Coin contract not deployed to detected network.";
        }
    }
    async function loadInitClockIn(evieCoin, address) {
        let startTime;
        try {
            const pastevents = await evieCoin.getPastEvents("ClockInTimeEvent", {
                user: address,
            });
            const mostRecent = pastevents[pastevents.length - 1];
            // Date is returned in seconds, needs to be changed to millis
            startTime = ethTimestampToDate(mostRecent.returnValues.timestamp);
            UserInfoWriteable.update((u) => {
                return Object.assign(Object.assign({}, u), { startTime });
            });
        }
        catch (error) {
            console.error(error);
            throw "Error getting initial clock in time";
        }
    }
    async function loadInitClockOut(evieCoin, address) {
        let endTime;
        try {
            const pastevents = await evieCoin.getPastEvents("ClockOutTimeEvent", {
                user: address,
            });
            const mostRecent = pastevents[pastevents.length - 1];
            // Date is returned in seconds, needs to be changed to millis
            endTime = ethTimestampToDate(mostRecent.returnValues.timestamp);
            UserInfoWriteable.update((u) => {
                return Object.assign(Object.assign({}, u), { endTime });
            });
        }
        catch (error) {
            console.error(error);
            throw "Error getting initial clock in time";
        }
    }
    async function setEventListeners(evieCoin, address) {
        evieCoin.events.ClockInTimeEvent({ user: address }, clockInListener);
        evieCoin.events.ClockOutTimeEvent({ user: address }, clockOutListener);
    }

    /* src/App.svelte generated by Svelte v3.31.2 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    // (60:2) {:else}
    function create_else_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Loading...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(60:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (43:2) {#if connected}
    function create_if_block(ctx) {
    	let div1;
    	let div0;
    	let p0;
    	let t0;
    	let t1_value = /*userInfo*/ ctx[1].bal + "";
    	let t1;
    	let t2;
    	let div5;
    	let div2;
    	let p1;
    	let t3;

    	let t4_value = (/*userInfo*/ ctx[1].startTime
    	? dateformat(/*userInfo*/ ctx[1].startTime, constants.dateFormatStr)
    	: "Please clock in to see your start time") + "";

    	let t4;
    	let t5;
    	let div3;
    	let button0;
    	let t7;
    	let div4;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			p0 = element("p");
    			t0 = text("Your current balance: ");
    			t1 = text(t1_value);
    			t2 = space();
    			div5 = element("div");
    			div2 = element("div");
    			p1 = element("p");
    			t3 = text("Start time: ");
    			t4 = text(t4_value);
    			t5 = space();
    			div3 = element("div");
    			button0 = element("button");
    			button0.textContent = "Clock in";
    			t7 = space();
    			div4 = element("div");
    			button1 = element("button");
    			button1.textContent = "Clock out";
    			add_location(p0, file, 45, 8, 1725);
    			attr_dev(div0, "class", "col-8");
    			add_location(div0, file, 44, 6, 1697);
    			attr_dev(div1, "class", "row");
    			add_location(div1, file, 43, 4, 1673);
    			add_location(p1, file, 50, 8, 1849);
    			attr_dev(div2, "class", "col-4");
    			add_location(div2, file, 49, 6, 1821);
    			add_location(button0, file, 56, 25, 2072);
    			attr_dev(div3, "class", "col-4");
    			add_location(div3, file, 56, 6, 2053);
    			add_location(button1, file, 57, 25, 2148);
    			attr_dev(div4, "class", "col-4");
    			add_location(div4, file, 57, 6, 2129);
    			attr_dev(div5, "class", "row");
    			add_location(div5, file, 48, 4, 1797);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, p0);
    			append_dev(p0, t0);
    			append_dev(p0, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div2);
    			append_dev(div2, p1);
    			append_dev(p1, t3);
    			append_dev(p1, t4);
    			append_dev(div5, t5);
    			append_dev(div5, div3);
    			append_dev(div3, button0);
    			append_dev(div5, t7);
    			append_dev(div5, div4);
    			append_dev(div4, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*clockIn*/ ctx[2], false, false, false),
    					listen_dev(button1, "click", /*clockOut*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*userInfo*/ 2 && t1_value !== (t1_value = /*userInfo*/ ctx[1].bal + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*userInfo*/ 2 && t4_value !== (t4_value = (/*userInfo*/ ctx[1].startTime
    			? dateformat(/*userInfo*/ ctx[1].startTime, constants.dateFormatStr)
    			: "Please clock in to see your start time") + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div5);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(43:2) {#if connected}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (/*connected*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "container");
    			add_location(div, file, 41, 0, 1627);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $APIStore;
    	let $UserInfoStore;
    	validate_store(APIStore, "APIStore");
    	component_subscribe($$self, APIStore, $$value => $$invalidate(6, $APIStore = $$value));
    	validate_store(UserInfoStore, "UserInfoStore");
    	component_subscribe($$self, UserInfoStore, $$value => $$invalidate(7, $UserInfoStore = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	
    	let storageValue;
    	let connected = false;
    	let web3;
    	let api;
    	let userInfo;

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		const instance = yield loadWeb3();
    		window["web3"] = web3 = instance;
    		yield initEvieCoin(web3);
    		api = $APIStore;
    		$$invalidate(1, userInfo = $UserInfoStore);
    		$$invalidate(0, connected = true);
    		console.log(api);
    	}));

    	function clockIn() {
    		return __awaiter(this, void 0, void 0, function* () {
    			yield api.EvieCoin.methods.clockStartTime().send({ from: userInfo.address });
    		});
    	}

    	function clockOut() {
    		return __awaiter(this, void 0, void 0, function* () {
    			yield api.EvieCoin.methods.clockEndTime().send({ from: userInfo.address });
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		__awaiter,
    		dateformat,
    		loadWeb3,
    		onMount,
    		constants,
    		APIStore,
    		initEvieCoin,
    		UserInfoStore,
    		storageValue,
    		connected,
    		web3,
    		api,
    		userInfo,
    		clockIn,
    		clockOut,
    		$APIStore,
    		$UserInfoStore
    	});

    	$$self.$inject_state = $$props => {
    		if ("__awaiter" in $$props) __awaiter = $$props.__awaiter;
    		if ("storageValue" in $$props) storageValue = $$props.storageValue;
    		if ("connected" in $$props) $$invalidate(0, connected = $$props.connected);
    		if ("web3" in $$props) web3 = $$props.web3;
    		if ("api" in $$props) api = $$props.api;
    		if ("userInfo" in $$props) $$invalidate(1, userInfo = $$props.userInfo);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [connected, userInfo, clockIn, clockOut];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
        props: {
            name: 'world'
        }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
