/**
 * InfiniteSlider.jsx - 无限滑动条组件
 *
 * 交互模式：
 *   默认显示输入框，聚焦后在上方弹出滑动条供拖动调值
 *   输入框始终可直接键入，滑动条失焦后收起
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react" // 导入React hooks
import { createPortal } from "react-dom"                                   // Portal渲染到body
import "../styles/InfiniteSlider.css"                                      // 导入滑动条样式

const pxPerStep = 20                                                       // 每步像素距离

const InfiniteSlider = ({ label, value, min, max, step = 1, integer = false, zoom = 1, onChange }) => { // 无限滑动条组件
  const safeStep = Math.abs(step) || 1                                     // 兜底步长
  const decimals = integer ? 0 : Math.max(0, -Math.floor(Math.log10(safeStep))) // 小数位数
  const dragRef = useRef({ dragging: false, startX: 0, startValue: 0 })    // 拖动状态
  const vpRef = useRef(null)                                               // viewport引用
  const wrapRef = useRef(null)                                             // 整体容器引用
  const inputRef = useRef(null)                                            // 输入框引用
  const [focused, setFocused] = useState(false)                            // 输入框聚焦状态
  const [inputText, setInputText] = useState(null)                         // 键入中的文本，null表示未编辑
  const [popupPos, setPopupPos] = useState({ left: 0, top: 0 })           // 弹出层fixed位置

  const clamp = useCallback(v => {                                         // 钳位
    if (min != null) v = Math.max(min, v)                                  // 下限
    if (max != null) v = Math.min(max, v)                                  // 上限
    return v
  }, [min, max])

  const quantize = useCallback(raw => {                                    // 量化
    let v = integer ? Math.round(raw) : Math.round(raw / safeStep) * safeStep // 对齐步长
    v = clamp(v)                                                           // 钳位
    return parseFloat(v.toFixed(decimals))                                 // 精度修正
  }, [integer, safeStep, clamp, decimals])

  const fmt = v => integer ? String(Math.round(v)) : v.toFixed(decimals)   // 格式化显示

  // ========== 刻度计算 ==========

  const { ticks, trackLeft, trackWidth } = useMemo(() => {                 // 计算刻度和track偏移
    const vw = vpRef.current?.offsetWidth || 140                           // 视口宽度
    const half = vw / 2                                                    // 半宽
    const extra = Math.ceil(half / pxPerStep) + 2                          // 视口外缓冲刻度数
    const startVal = value - extra * safeStep                              // 起始值
    const endVal = value + extra * safeStep                                // 结束值
    const firstTick = Math.ceil(startVal / safeStep) * safeStep            // 第一个刻度值
    const result = []                                                      // 刻度数组
    for (let v = firstTick; v <= endVal; v += safeStep) {                  // 遍历生成
      if (min != null && v < min) continue                                 // 跳过下限外
      if (max != null && v > max) continue                                 // 跳过上限外
      const stepsFromZero = Math.round(v / safeStep)                       // 距离0的步数
      const isMajor = stepsFromZero % 5 === 0                              // 每5步一个主刻度
      result.push({ v, isMajor })                                         // 加入数组
    }
    if (result.length === 0) return { ticks: [], trackLeft: 0, trackWidth: 0 }
    const firstVal = result[0].v                                           // 第一个刻度值
    const totalWidth = (result.length - 1) * pxPerStep                     // track总宽度
    const valueOffset = (value - firstVal) / safeStep * pxPerStep          // 当前值偏移
    const left = half - valueOffset                                        // track的left
    return { ticks: result, trackLeft: left, trackWidth: totalWidth + pxPerStep }
  }, [value, min, max, safeStep])

  // ========== 拖动逻辑 ==========

  const onSliderMouseDown = useCallback(e => {                             // 滑动条鼠标按下
    e.stopPropagation()                                                    // 阻止冒泡
    e.preventDefault()                                                     // 阻止默认
    dragRef.current = { dragging: true, startX: e.clientX, startValue: value }
    const onMove = me => {                                                 // 移动处理
      if (!dragRef.current.dragging) return
      const deltaX = (me.clientX - dragRef.current.startX) / zoom          // 修正位移
      const raw = dragRef.current.startValue - deltaX / pxPerStep * safeStep
      onChange(quantize(raw))                                              // 回调
    }
    const onUp = () => {                                                   // 释放
      dragRef.current.dragging = false
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [value, zoom, safeStep, quantize, onChange])

  useEffect(() => () => { dragRef.current.dragging = false }, [])          // 卸载清理

  // ========== 输入框逻辑 ==========

  const commitInput = useCallback(() => {                                  // 提交输入
    if (inputText != null) {                                               // 有编辑内容
      const num = parseFloat(inputText)                                    // 解析
      if (!isNaN(num)) onChange(quantize(num))                             // 有效则回调
      setInputText(null)                                                   // 清除编辑状态
    }
  }, [inputText, quantize, onChange])

  const onInputKey = useCallback(e => {                                    // 键盘事件
    e.stopPropagation()                                                    // 阻止冒泡
    if (e.key === "Enter") { commitInput(); e.target.blur() }             // 回车提交并失焦
    if (e.key === "Escape") { setInputText(null); e.target.blur() }      // ESC取消并失焦
  }, [commitInput])

  const onBlur = useCallback(e => {                                        // 失焦处理
    if (wrapRef.current?.contains(e.relatedTarget)) return                 // 焦点仍在容器内则忽略
    if (dragRef.current.dragging) return                                   // 拖动中不收起
    commitInput()                                                          // 提交输入
    setFocused(false)                                                      // 收起滑动条
  }, [commitInput])

  // ========== 渲染 ==========

  const displayValue = inputText != null ? inputText : fmt(value)          // 显示值

  return (
    <div className="inf-slider" ref={wrapRef} onBlur={onBlur}>
      <span className="inf-slider-label">{label}</span>
      <div className="inf-slider-input-wrap">
        {focused && createPortal(                                          // Portal到body，脱离NodePanel
          <div className="inf-slider-popup"
            style={{ left: popupPos.left, top: popupPos.top }}
            onMouseDown={e => e.preventDefault()}>
            <div className="inf-slider-viewport" ref={vpRef}
              onMouseDown={onSliderMouseDown}>
              <div className="inf-slider-track"
                style={{ left: trackLeft, width: trackWidth }}>
                {ticks.map((t, i) => (
                  <div key={i} className={`inf-slider-tick${t.isMajor ? " major" : ""}`}
                    style={{ left: i * pxPerStep }}>
                    {t.isMajor && <span className="inf-slider-tick-label">{fmt(t.v)}</span>}
                  </div>
                ))}
              </div>
              <div className="inf-slider-needle" />
            </div>
          </div>,
          document.body
        )}
        <input className="inf-slider-input" ref={inputRef}
          type="text"
          value={displayValue}
          onFocus={() => {                                                  // 聚焦时计算弹出位置
            const rect = inputRef.current?.getBoundingClientRect()          // 获取输入框屏幕位置
            if (rect) setPopupPos({ left: rect.left + rect.width / 2, top: rect.top - 6 }) // 输入框上方6px居中
            setFocused(true)
          }}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={onInputKey}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  )
}

export default InfiniteSlider                                              // 导出组件
