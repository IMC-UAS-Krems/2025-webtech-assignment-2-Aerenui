// internal globals
/**
 * @type {Component[]}
 * */
const COMPONENT_REGISTRY = [];
/**
 * @type {undefined|number}
 * */
let UNIQUE_ID_STORE = undefined;

window.onload = () => {afterLoad()};

function afterLoad() {
    // const reg = document.getElementById("components");
    const reg = document.getElementsByTagName("template")[0].content;
    for (const e of reg.children) {
        let content = e.innerHTML;
        // console.log("DBG: component init: e.tag = '"+e.tagName+"', e.child.0.tag = '"+(e.children[0] === null ? "null" : e.children[0].tagName)+"', skipAttr='"+ e.getAttribute("skip")+"'");
        if(e.getAttribute("skip") === e.children[0].tagName.toLowerCase()) {
            content = e.children[0].innerHTML;
            // console.log("special component");
            // console.log(content);
        }
        COMPONENT_REGISTRY.push(new Component(e.id, false, content));
    }


    importSyntheticComponents();
    populateItems();
    general_page_init();
    window.onhashchange = (e) => {
        const new_hash = window.location.hash;

        switch (new_hash) {
            case "#shop":
                if(CURRENT_PAGE === "shopping") break
                if (CURRENT_PAGE === "preview" || CURRENT_PAGE === "payment" || CURRENT_PAGE === "thanks") {
                  action_preview_back();
                }
                break
            case "#preview":
                if(CURRENT_PAGE === "preview") break;
                if (CURRENT_PAGE === "shopping") {
                    if (basktet_cnt > 0) {
                        action_checkout_proceed();
                    } else {
                        e.preventDefault(); // does not work for some unknown reason
                        // history.pushState(null, null, "#shop"); // fix for preventDefault not working
                        window.location.hash = "shop";
                    }
                }
                if(CURRENT_PAGE === "payment") {
                  action_payment_back();
                }
                break
            case "#payment":
                if(CURRENT_PAGE === "payment") break;
                if(CURRENT_PAGE === "preview") {
                    action_preview_to_payment();
                    break;
                }
                if(CURRENT_PAGE === "shopping") {
                    if (basktet_cnt > 0) {
                        action_preview_to_payment();
                    } else {
                        e.preventDefault(); // does not work for some unknown reason
                        // history.pushState(null, null, "#shop"); // fix for preventDefault not working
                        window.location.hash = "shop";
                    }
                }
                console.error("unknown page '"+CURRENT_PAGE+"'");
                break
            case "#thanks":
                if(CURRENT_PAGE !== "thanks")
                    action_preview_back();
                break
        }
    };
    if(has_cookie_state())
        cookie_start();
    else
        render_shopping_page();
}

function importSyntheticComponents() {
    const make_component = (id, content) => { COMPONENT_REGISTRY.push(new Component(id, false, content)); };

    make_component("div", "<div>%</div");
    make_component("p", "<p>%</p");
    make_component("label", "<label> % </label>");
    make_component("span", "<span> % </span>");
    make_component("a", "<a href=\"%\"> % </a>");
    make_component("row", "<div class='row'> % </div>");
    make_component("row-centered", "<div class='row justify-content-center'> % </div>");
    make_component("br", "<div class='w-100 invisible'>empty divider</div>");
    make_component("title", "<h1 class='h1'>%</h1>");
    make_component("h3", "<h3 class='h3'>%</h3>")
}

// ---------------------------------------------------------------------------------------------------------------
// types


class Component {
    constructor(id, is_err=false, pre_content=undefined) {
        this.is_err = is_err;
        if(is_err) {
            this.error = id;
        } else {
            this.id = id;
            this.parts = (pre_content === undefined ? document.getElementById(id).innerHTML : pre_content).split('%');
            this.params_count = this.parts.length - 1;
        }
    }

    /**
     * @param {boolean} include_id
     * @param {undefined|string} id
     * @param {string|BCResult} params
     * @return BCResult
     * */
    build_with_id(include_id, id=undefined, ...params) {
        if(this.is_err) {
            return this.error;
        }
        if(this.params_count !== params.length) {
            console.error("[COMPONENT SYSTEM] invalid parameter count, excepted " + this.params_count + " got " + params.length + " | component id='"+this.id+"'");
            return new BCResult(this.id, "<s> invalid parameter count, expected " + this.params_count + " got " + params.length + " </s>", undefined);
        }
        let result = this.parts[0];
        for(let i= 0; i < this.params_count; i++) {
            result += params[i] instanceof BCResult ? params[i].content : params[i];
            result += this.parts[i+1];
        }

        if (include_id === true) {
            // SLOW version
            // const dom = new DOMParser().parseFromString("<div id='UNIQUE_SELECTOR'>" + result + "</div>", "text/html");
            // let rs = dom.getElementById("UNIQUE_SELECTOR");

            let wrapper= document.createElement('div');
            wrapper.innerHTML= result;
            let rs= wrapper.children[0];


            if(id === undefined) {
                if(UNIQUE_ID_STORE === undefined) {
                    UNIQUE_ID_STORE = Date.now();
                } else {
                    UNIQUE_ID_STORE += 1;
                }
                rs.id = "e_" + UNIQUE_ID_STORE.toString();
            } else {
                rs.id = id;
            }

            // SLOW version
            // return new BCResult(this.id, rs.outerHTML, rs.id);
            return new BCResult(this.id, wrapper.innerHTML, rs.id);
        }
        return new BCResult(this.id, result, undefined);
    }

    build(...params) { return this.build_with_id(false, undefined, ...params); }
}

class BCResult {
    constructor(component_id, content, unique_id=undefined) {
        this.content = content;
        this.component_id = component_id;
        this.unique_id = unique_id;
    }
    /**
     * @param {string} [parent_id="body"]
     * */
    append(parent_id="body") { document.getElementById(parent_id).innerHTML += this.content }
    rerender(...params) {
        if (this.unique_id === undefined) {
            console.error("not updatable, id='" + this.unique_id + "'");
            return;
        }
        const new_c = get_component(this.component_id).build_with_id(true, this.unique_id, ...params);
        document.getElementById(this.unique_id).outerHTML = new_c.content;
    }
    /**
     * @param {string|BCResult} addition
     * */
    additive_rerender(addition) {
        if (this.unique_id === undefined) {
            console.error("not updatable, id='" + this.unique_id + "'");
            return;
        }
        document.getElementById(this.unique_id).innerHTML += addition instanceof BCResult ? addition.content : addition;
    }
    /**
     * @return void
     * @param {boolean} visible
     * */
    setVisible(visible) {
        if (this.unique_id === undefined) {
            console.error("not updatable, id='" + this.unique_id + "'");
            return;
        }
        if(visible) {
            document.getElementById(this.unique_id).classList.remove("hide");
        } else {
            document.getElementById(this.unique_id).classList.add("hide");
        }
    }

    /**
     * deletes item
     * */
    remove() {
        if (this.unique_id === undefined) {
            console.error("not updatable, id='" + this.unique_id + "'");
            return;
        }
        const item = document.getElementById(this.unique_id);
        if (item !== null)
            item.remove();
    }
}

/**
 * @return Component
 * @param {string} id
 * */
function get_component(id) {
    const rs = COMPONENT_REGISTRY.find((n) => n.id === id);
    if (rs === undefined)
        return new Component("<s> component not found id='"+id+"'  </s>", true);
    return rs;
}

// ---------------------------------------------------------------------------------------------------------------
// public component functions

/**
 * @return BCResult
 * @param {string} id
 * @param {string|BCResult} params
 * */
const make = (id, ...params) => get_component(id).build(...params);
/**
 * @return BCResult
 * @param {string} id
 * @param {string|BCResult} params
 * */
const make_updatable = (id, ...params) => get_component(id).build_with_id(true, undefined, ...params);
/**
 * @return string
 * @param {string|BCResult} items
 * */
const join = (...items) => items.map((v) => v instanceof BCResult ? v.content : v).join("\n");


// ---------------------------------------------------------------------------------------------------------------
// state save & load

/**
 * RAW
 * @param {string} value
 * */
function internal_save_state(value) {
    document.cookie = value;
}

/**
 * RAW
 * @return {string}
 * */
function internal_load_state() {
    return document.cookie;
}


function save_page_state() {
    const obj = {
        CURRENT_PAGE: CURRENT_PAGE,
        ITEMS: [...BASKET_ITEMS.entries()]
    };
    const out = JSON.stringify(obj);
    internal_save_state(out);
}

function reset_page_state() {
    // document.cookie += "expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    document.cookie = "";
}

function load_page_state() {
    const data = internal_load_state();
    let obj;
    try {
        obj = JSON.parse(data);
    } catch (e) {
        console.error("failed to parse cookies");
        reset_page_state();
    }
    CURRENT_PAGE = obj.CURRENT_PAGE;
    BASKET_ITEMS = new Map(obj.ITEMS);

}

/**
 * @return {boolean}
 */
function has_cookie_state() {
    return document.cookie.length > 0;
}




// ---------------------------------------------------------------------------------------------------------------
// page code


class Item  {
    /**
     * @param {String} id
     * @param {String} name
     * @param {String} description
     * @param {Number} price
     * @param {String} image_url
     *
     * @property {String} id
     * @property {String} name
     * @property {String} description
     * @property {Number} price
     * @property {String} image_url
     * @property {BCResult|undefined} buy_or_modify_holder
     * */
    constructor(id, name, description, price, image_url) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.image_url = image_url;
        this.buy_or_modify_holder = undefined;
    }
    build_component() {
        let btn = make_updatable("div", make("items-item-buy-btn", this.id));
        this.buy_or_modify_holder = btn;
        return make("items-item", this.image_url, this.name, this.description, this.price.toString(), btn);
    }
}

let items_container;

/**
 * @type {Map<String,Item>}
 * */
let ITEMS = new Map();
function populateItems() {
    let id_cnt = 1;
    const make = (name, description, price, image_url) => {
        ITEMS.set("i"+id_cnt.toString(), new Item("i"+id_cnt.toString(), name, description, price, image_url));
        id_cnt++;
    };

    make("Base Item", "description", 10, "/img/cat.png");
    for(let i=1;i<15;i++) {
        make("Item "+i.toString(), "description of item "+i.toString(), 2**i, "/img/cat.png");
    }

    make("Martin", "mr", 10000, "/img/cat.png");
}





let basktet_cnt;

/**
 * @type {BCResult}
 * */
let modal_basket;

let basket_total1;
let basket_total2;
let modal_checkout_btn;

let CURRENT_PAGE = "shopping";


/**
 * @param {boolean} enabled
 * */
function basket_modal_set_enabled(enabled) {
    document.getElementById("basket-modal-btn").disabled = !enabled;
    if (!enabled) {
        // document.getElementById("basket-modal-btn").setAttribute("disabled", "disabled");
        // document.getElementById("basket-modal-btn").attributes.setNamedItem("disabled");
    } else {
        // document.getElementById("basket-modal-btn").removeAttribute("disabled");
    }

}


/**
 * items on all pages
 * */
function general_page_init() {
    modal_basket = make_updatable("div", "empty");

    basktet_cnt = 0;

    basket_total1 = make_updatable("span", basktet_cnt.toString());
    basket_total2 = make_updatable("span", basktet_cnt.toString());
    modal_checkout_btn = make_updatable("modal-checkout-btn", "disabled");

    make("navbar", "Shop", basket_total1, make("basket-icon"))
        .append("nav");

    make("basket-modal", modal_basket, basket_total2, modal_checkout_btn).append();

    make("footer")
        .append("foot");

    items_container = make_updatable("row-centered", "");

    make("items-container", items_container).append();
}

// call on initialization
function render_shopping_page() {
    // window.history.replaceState("","", "/shop");
    window.location.hash = "shop";
    window.scrollTo(0,0);

    items_container.rerender("");

    for(const [_id, item] of ITEMS) {
        items_container.additive_rerender(item.build_component());
    }
}


/**
 * @type {Map<String, Number>} Map<id, count>
 */
let BASKET_ITEMS = new Map();
/**
 * @type {Map<String, BCResult>} Map<id, updatable>
 */
const BASKET_MODAL_HANDLES = new Map();


/**
 * calculates current basket price
 * @return {number}
 */
const calc_price = () => BASKET_ITEMS.entries().map(([k, v]) => ITEMS.get(k).price * v).reduce((p, c) => p + c, 0);

function rerender_basket_price() {
    // update price
    const price = calc_price();
    basktet_cnt = price;
    basket_total1.rerender((price).toString());
    basket_total2.rerender((price).toString());
    // update modal

    // used for adding items:
    // modal_basket.additive_rerender(make("modal-item", "counter_"+counter, counter.toString()));
}

function display_empty_if_basket_empty(old_price, new_price) {
    if (old_price === 0) {
        modal_basket.rerender("");
        modal_checkout_btn.rerender("");
    }
    if(new_price === 0) {
        modal_basket.rerender("empty");
        modal_checkout_btn.rerender("disabled");
    }
}

/**
 * @param {String} id
 * */
function action_item_buy(id) {
    // console.log("called action_item_buy with id='"+id+"'");
    display_empty_if_basket_empty(basktet_cnt,1);

    BASKET_ITEMS.set(id, 1);

    rerender_basket_price();

    let modal_updt = make_updatable("modal-item", "", ITEMS.get(id).name, ITEMS.get(id).price.toString(), id);

    BASKET_MODAL_HANDLES.set(id, modal_updt);
    modal_basket.additive_rerender(modal_updt);

    // update buy button to quantity changer
    ITEMS.get(id).buy_or_modify_holder.rerender(make("items-item-buy-modify", id, id, id, id, id, id, id, id, id, id, id, id));
    save_page_state();
}

/**
 * @param {String} id
 * */
function action_item_remove(id) {
    // console.log("called action_item_remove with id='"+id+"'");
    BASKET_ITEMS.delete(id);
    if(BASKET_MODAL_HANDLES.has(id)) {
        BASKET_MODAL_HANDLES.get(id).remove();
        BASKET_MODAL_HANDLES.delete(id);
    }
    rerender_basket_price();
    ITEMS.get(id).buy_or_modify_holder.rerender(make("items-item-buy-btn", id));

    display_empty_if_basket_empty(1, basktet_cnt);
    save_page_state();
}

/**
 * @param {String} id
 * @param {number} qty
 * */
function action_item_update(id, qty) {
    // console.log("called action_item_update with id='"+id+"', qty="+qty.toString());
    BASKET_ITEMS.set(id, qty);
    rerender_basket_price();
    BASKET_MODAL_HANDLES.get(id).rerender(qty === 1 ? "" : qty.toString()+"x", ITEMS.get(id).name, (ITEMS.get(id).price * qty).toString(), id); // component-id="modal-item"
    save_page_state();
}


function action_checkout_proceed() {
    CURRENT_PAGE = "preview";
    window.location.hash = "preview";
    basket_modal_set_enabled(false);
    items_container.rerender("");
    save_page_state();
    render_preview_page();
    window.scrollTo(0,0);
}

/**
 * when starting with previous state
 * */
function cookie_start(load_state=true){
    if(load_state)
        load_page_state();

    document.getElementById("basket-modal-btn").classList.remove("hide");

    switch (CURRENT_PAGE) {
        case "shopping":
            if(window.location.hash === "#preview" || window.location.hash === "#payment") {
                CURRENT_PAGE = "preview";
                cookie_start(false);
                return;
            }
            render_shopping_page();
            const basket_copy = new Map(BASKET_ITEMS.entries());
            BASKET_ITEMS.clear();
            rerender_basket_price();
            for ([id,cnt] of basket_copy.entries()) {
                action_item_buy(id);
                if (cnt > 1) {
                    action_item_update(id, cnt);
                    document.getElementById("qty_mod_"+id).value = cnt.toString();
                }
            }
            break;
        case "preview":
            if(window.location.hash === "#shop") {
                CURRENT_PAGE = "shopping";
                cookie_start(false);
                return;
            }
            if(window.location.hash === "#payment"){
                CURRENT_PAGE = "payment";
                cookie_start(false);
                return;
            }
            rerender_basket_price();
            action_checkout_proceed(); // calls render_preview_page();
            basket_modal_set_enabled(false);
            // render_preview_page();
            break
        case "payment":
            if(window.location.hash === "#preview") {
                CURRENT_PAGE = "preview";
                cookie_start(false);
                return;
            }
            if(window.location.hash === "#shop") {
                CURRENT_PAGE = "shopping";
                cookie_start(false);
                return;
            }
            rerender_basket_price();
            render_payment_page();
            basket_modal_set_enabled(false);
            break
        case "thanks":
            if(window.location.hash === "#shop") {
                CURRENT_PAGE = "shopping";
                cookie_start(false);
                return;
            }
            render_thanks_page();
            basket_modal_set_enabled(false);
            break;
        default:
            console.error("invalid page state");
            break;
    }
}


function render_preview_page() {
    // window.history.replaceState("","", "/preview");
    window.location.hash = "preview";
    window.scrollTo(0,0);

    basket_modal_set_enabled(false);

    const items = BASKET_ITEMS
        .entries()
        .map(([id, cnt]) => make("preview-table-item", ITEMS.get(id).name, ITEMS.get(id).description, cnt.toString(), (ITEMS.get(id).price * cnt).toString()))
        .reduce((a,b) => a+b.content+"\n", "");

    // the comment parts are a fix to prevent browser from removing template argument marker
    const table = make("preview-table-holder",
        "-->"+items+"<!--"
    );

    const summary = join(make("h3", "total is "+basktet_cnt.toString() + "€"), make("preview-payment-btn"));

    items_container.rerender(join(make("preview-nav"), make("br"), make("title", "Your order"), table, summary));
}

function action_preview_back() {
    CURRENT_PAGE = "shopping";
    window.location.hash = "shop";
    save_page_state();
    items_container.rerender("");
    cookie_start();
    basket_modal_set_enabled(true);
    window.scrollTo(0,0);
}

function action_preview_to_payment() {
    CURRENT_PAGE = "payment";
    window.location.hash = "payment";
    save_page_state();
    items_container.rerender("");
    cookie_start();
    basket_modal_set_enabled(false);
    window.scrollTo(0,0);
}

function render_payment_page() {
    window.location.hash = "payment";
    basket_modal_set_enabled(false);
    window.scrollTo(0,0);

    items_container.rerender(join(make("payment-nav"), make("div",make("payment-contactform"))));
}

function action_payment_back() {
    CURRENT_PAGE = "preview";
    window.location.hash = "preview";
    save_page_state();
    items_container.rerender("");
    cookie_start();
    basket_modal_set_enabled(false);
    window.scrollTo(0,0);
}

/**
 * @type {Set<string>}
 * */
const WAS_EVER_FULL_FORM_VALIDATION = new Set();



/**
 * @param {HTMLInputElement} input_element
 * */
function form_validate_cardname(input_element) {
    if((input_element.value.length === 0 && WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id))) {
        input_element.classList.add("is-invalid");
    } else {
        input_element.classList.remove("is-invalid");
    }

    if(!WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id) && input_element.value.length > 0) {
        WAS_EVER_FULL_FORM_VALIDATION.add(input_element.id);
    }
}

/**
 * @param {HTMLInputElement} input_element
 * */
function form_validate_cardnumber(input_element) {
    // let new_value = input_element.value.trim().replace(/\D/g,'');
    if ((input_element.value.length === 0 && WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id)) || input_element.value.length < 7 /*|| new_value.length !== input_element.value.trim().length*/) {
        input_element.classList.add("is-invalid");
    } else {
        input_element.classList.remove("is-invalid");
    }

    if(!WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id) && input_element.value.length > 0) {
        WAS_EVER_FULL_FORM_VALIDATION.add(input_element.id);
    }
}

/**
 * @type {Map<string, boolean>}
 * */
const CARDEXPIRE_VALIDATE_REG = new Map();

/**
 * @param {HTMLInputElement} input_element
 * */
function form_validate_cardexire(input_element) {
    const value = input_element.value;

    let switch_v = true;
    if(CARDEXPIRE_VALIDATE_REG.has(input_element.id)) {
        switch_v = CARDEXPIRE_VALIDATE_REG.get(input_element.id);
    }

    // console.log("switch = '"+switch_v.toString()+"'");

    if(value.length === 2) {
        if (switch_v) {
            input_element.value = value + "/";
        }
        CARDEXPIRE_VALIDATE_REG.set(input_element.id, !switch_v);
    } else if (value.length === 3) {
        if(value[2] !== '/'){
            input_element.value = value[0].toString() + value[1] + '/' + value[2];
        }
    }

    // validation

    if((input_element.value.length === 0 && WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id)) || value.length !== 5 ||
        (value.length === 5 && (
            "01".indexOf(value[0]) === -1 ||
            "0123456789".indexOf(value[1]) === -1 ||
            value[2] !== '/' ||
            "0123456789".indexOf(value[3]) === -1 ||
            "0123456789".indexOf(value[4]) === -1 ||
            (value[0] === '1' && "012".indexOf(value[1]) === -1)
        ))) {

        input_element.classList.add("is-invalid");
    } else {
        input_element.classList.remove("is-invalid");
    }

    if(!WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id) && input_element.value.length > 0) {
        WAS_EVER_FULL_FORM_VALIDATION.add(input_element.id);
    }

}


/**
 * @param {HTMLInputElement} input_element
 * */
function form_validate_cardcvv(input_element) {
    const value = input_element.value;
    if (value.length > 3) {
        input_element.value = value.substring(0, 3);
    }

    if((input_element.value.length === 0 && WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id)) || input_element.value.length !== 3) {
        input_element.classList.add("is-invalid");
    } else {
        input_element.classList.remove("is-invalid");
    }

    if(!WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id) && input_element.value.length > 0) {
        WAS_EVER_FULL_FORM_VALIDATION.add(input_element.id);
    }
}



/**
 * @param {HTMLInputElement} input_element
 * */
function form_validate_email(input_element) {
    const value = input_element.value;

    if((value.length === 0 && WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id)) || value.indexOf('@') === -1 || value.indexOf('.') === -1 || value.indexOf('.') === value.length-1) {
        input_element.classList.add("is-invalid");
    } else {
        input_element.classList.remove("is-invalid");
    }

    if(!WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id) && value.length > 0) {
        WAS_EVER_FULL_FORM_VALIDATION.add(input_element.id);
    }
}

/**
 * @param {HTMLInputElement} input_element
 */
function form_validate_name_and_surname(input_element) {
    const value = input_element.value.trim();
    if ((value.length === 0 && WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id)) || value.indexOf(' ') === -1) {
        input_element.classList.add("is-invalid");
    } else {
        input_element.classList.remove("is-invalid");
    }

    if(!WAS_EVER_FULL_FORM_VALIDATION.has(input_element.id) && value.length > 0) {
        WAS_EVER_FULL_FORM_VALIDATION.add(input_element.id);
    }
}

/**
 * @param {string} input_ids
 * */
function form_verify(...input_ids) {
    return !input_ids.map((id) => document.getElementById(id).classList.contains("is-invalid")).reduce((a, b) => a || b);
}

/**
 * @param {HTMLFormElement} form
 * */
function action_payment_submit(form) {
    return form_verify(...Array.from(form.getElementsByTagName("input")).map((e) => e.id));
}

function action_payment_proceed(verify=true) {
    if (verify && !action_payment_submit(document.getElementById("contactForm"))) {
        return;
    }

    CURRENT_PAGE = "thanks";
    window.location.hash = "thanks";
    save_page_state();
    items_container.rerender("");
    cookie_start();
    basket_modal_set_enabled(false);
    window.scrollTo(0,0);
}

function render_thanks_page() {
    window.location.hash = "thanks";

    // prevent basket from being full in any case
    BASKET_ITEMS.clear();
    save_page_state();

    // hide basket
    document.getElementById("basket-modal-btn").classList.add("hide");

    items_container.rerender("<h2> thanks, " + "Joseph" + " </h2> <br> <button class='btn btn-primary' onclick='action_thanks_back_to_shop();'>back to shop</button>");
}

function action_thanks_back_to_shop() {
    BASKET_ITEMS.clear();
    save_page_state();
    window.location.hash = "#shop";

}
