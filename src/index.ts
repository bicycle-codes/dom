const SECOND = 1000

export const dom = {
    DEFAULT_TIMEOUT: (5 * SECOND),
    getComputedStyle,
    isElementVisible,
    waitForText,
    waitFor,
    click,
    event: domEvent,
    qs: document.querySelector.bind(document),
    qsa: document.querySelectorAll.bind(document)
}

/**
 * @param {Element} element
 */
function isStyleVisible (element:Element):boolean {
    const ownerDocument = element.ownerDocument
    if (!ownerDocument || !ownerDocument.defaultView) {
        console.warn('invalid element?', element)
        throw new Error('element has no ownerDocument')
    }

    const {
        display,
        visibility,
        opacity
    } = ownerDocument.defaultView.getComputedStyle(element)

    return (
        display !== 'none' &&
        visibility !== 'hidden' &&
        visibility !== 'collapse' &&
        opacity !== '0' &&
        Number(opacity) !== 0
    )
}

/**
 * Return an object containing the values of all CSS properties of an element,
 * after applying active stylesheets.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle|MDN}
 * @param {Element | HTMLElement} element
 */
function getComputedStyle (element:Element|HTMLElement) {
    const ownerDocument = element.ownerDocument

    if (!ownerDocument || !ownerDocument.defaultView) {
        console.warn('invalid element?', element)
        throw new Error('element has no ownerDocument')
    }

    return ownerDocument.defaultView.getComputedStyle(element)
}

/**
 * Return if the given attribute is visible.
 *
 * @param {Element} element
 * @param {Element} [previousElement]
 * @returns {boolean}
 */
function isAttributeVisible (element:Element, previousElement?:Element):boolean {
    return (
        !element.hasAttribute('hidden') &&
    (element.nodeName === 'DETAILS' && previousElement?.nodeName !== 'SUMMARY'
        ? element.hasAttribute('open')
        : true)
    )
}

/**
 * Return if the given element is visible.
 * Copy pasted from https://raw.githubusercontent.com/testing-library/jest-dom/master/src/to-be-visible.js
 *
 * @param {Element} element
 * @param {Element} [previousElement]
 * @returns {boolean}
 */
function isElementVisible (
    element:Element,
    previousElement?:Element
):boolean {
    return (
        isStyleVisible(element) &&
        isAttributeVisible(element, previousElement) &&
        (!element.parentElement ||
            dom.isElementVisible(element.parentElement, element))
    )
}

/**
 * Look for the given text within the given parent element. Return the element
 * containing the text.
 *
 * @param {{
 *    text?: string,
 *    timeout?: number
 *    element: Element,
 *    multipleTags?: boolean,
 *    regex?: RegExp
 * }} args
 */
function waitForText (args:{
    text?:string,
    timeout?:number,
    element:Element,
    multipleTags?:boolean,
    regex?:RegExp
}):Promise<Element> {
    return waitFor({
        timeout: args.timeout
    }, () => {
        const {
            element,
            text,
            regex,
            multipleTags
        } = args

        const elems:Element[] = []

        let maxLoop = 10000
        const stack:Element[] = [element]
        // Walk the DOM tree breadth first and build up a list of
        // elements with the leafs last.
        while (stack.length > 0 && maxLoop-- >= 0) {
            const current = stack.pop()
            if (current && current.children.length > 0) {
                stack.push(...current.children)
                elems.push(...current.children)
            }
        }

        // Loop over children in reverse to scan the LEAF nodes first.
        let match:HTMLElement|null = null
        for (let i = elems.length - 1; i >= 0; i--) {
            const node = elems[i]
            if (!node.textContent) continue

            if (regex && regex.test(node.textContent)) {
                return node
            }

            if (text && node.textContent?.includes(text)) {
                return node
            }

            if (text && multipleTags) {
                if (text[0] !== (node.textContent)[0]) continue

                // if equal, check the sibling nodes
                let sibling = node.nextSibling
                let i = 1

                // while there is a potential match, keep checking the siblings
                while (i < text.length) {
                    if (sibling && (sibling.textContent === text[i])) {
                        // is equal still, check the next sibling
                        sibling = sibling.nextSibling
                        i++
                        match = node.parentElement
                    } else {
                        if (i === (text.length - 1)) return node.parentElement
                        match = null
                        break
                    }
                }
            }
        }

        return match
    })
}

/**
 * @param {{
 *    selector?: string,
 *    visible?: boolean, // the element needs to be visible
 *    timeout?: number // how long to wait
 * }} args
 * @param {() => HTMLElement |  null | undefined} [lambda]
 */
function waitFor (args:{
    selector?:string,
    visible?:boolean,
    timeout?:number
}|string, lambda?:() => Element|null):Promise<Element> {
    let selector:string
    let visible:boolean = true
    let timeout = dom.DEFAULT_TIMEOUT
    if (typeof args === 'string') {
        selector = args
    } else {
        if (typeof args.visible === 'undefined') visible = true
        timeout = args.timeout ?? dom.DEFAULT_TIMEOUT
        selector = args.selector!
    }

    return new Promise((resolve, reject) => {
        if (!lambda && selector) {
            lambda = () => document.querySelector(selector)
        }

        const interval = setInterval(() => {
            if (!lambda) {
                throw new Error('lambda or selector required')
            }

            const el = lambda()
            if (el) {
                if (visible && !dom.isElementVisible(el)) return
                clearTimeout(timer)
                return resolve(el)
            }
        }, 50)

        const timer = setTimeout(() => {
            clearInterval(interval)
            const wantsVisable = visible ? 'A visible selector' : 'A Selector'
            reject(new Error(
                `${wantsVisable} was not found after ${timeout}ms (${selector})`
            ))
        }, timeout)
    })
}

/**
 * Click the given element.
 *
 * @param {Element} element
 */
function click (element:Element) {
    domEvent({
        event: new window.MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0
        }),
        element
    })
}

/**
 * Dispatch an event from the given element.
 *
 * @param {{
 *   event: string | Event,
 *   element?: HTMLElement | Element | typeof window
 * }} args
 */
function domEvent (args:{
    event:string|Event;
    element?:HTMLElement|Element|typeof window
}) {
    let {
        event,
        element = window
    } = args

    if (typeof event === 'string') {
        event = new window.CustomEvent(event)
    }

    if (typeof event !== 'object') {
        throw new Error('event should be of type Event')
    }

    element.dispatchEvent(event)
}
