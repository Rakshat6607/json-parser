import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { parse, parseToAST } from './parser.js';
import { stringify } from './stringify.js';
import { JSONSyntaxError } from './error.js';

const SAMPLE_JSON = `{
  "name": "craft-json",
  "version": "1.0.0",
  "description": "Custom high-performance JSON parser & visualizer",
  "keywords": ["json", "parser", "jsx", "ast"],
  "settings": {
    "strict": true,
    "maxDepth": 512,
    "features": {
      "astGeneration": true,
      "detailedDiagnostics": true,
      "treeViewer": true
    }
  },
  "stats": {
    "downloads": 12500,
    "rating": 4.95,
    "verified": true,
    "license": null
  }
}`;

/**
 * Recursive JSON Tree Node component for rendering objects, arrays, and primitives.
 */
function JsonTreeNode({ keyName, value, depth = 0, isLast = true }) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const renderValueBadge = () => {
    if (value === null) {
      return <span style={{ color: '#888', fontStyle: 'italic' }}>null</span>;
    }
    if (typeof value === 'boolean') {
      return <span style={{ color: '#00bcd4', fontWeight: 'bold' }}>{String(value)}</span>;
    }
    if (typeof value === 'number') {
      return <span style={{ color: '#ff9800' }}>{value}</span>;
    }
    if (typeof value === 'string') {
      return <span style={{ color: '#4caf50' }}>"{value}"</span>;
    }
    return null;
  };

  if (!isObject) {
    return (
      <div style={{ paddingLeft: `${depth * 18}px`, fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6' }}>
        {keyName !== undefined && (
          <span style={{ color: '#9c27b0', fontWeight: '500' }}>"{keyName}": </span>
        )}
        {renderValueBadge()}
        {!isLast && <span style={{ color: '#666' }}>,</span>}
      </div>
    );
  }

  const entries = isArray
    ? value.map((v, i) => [i, v])
    : Object.entries(value);

  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';
  const countLabel = isArray ? `${value.length} items` : `${entries.length} keys`;

  return (
    <div style={{ paddingLeft: `${depth * 18}px`, fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6' }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '10px', color: '#888', width: '12px', display: 'inline-block' }}>
          {collapsed ? '▶' : '▼'}
        </span>
        {keyName !== undefined && (
          <span style={{ color: '#9c27b0', fontWeight: '500' }}>"{keyName}": </span>
        )}
        <span style={{ color: '#666' }}>{openBracket}</span>
        {collapsed && (
          <span
            style={{
              background: '#333',
              color: '#bbb',
              borderRadius: '4px',
              padding: '1px 6px',
              fontSize: '11px',
              margin: '0 4px',
            }}
          >
            ... {countLabel}
          </span>
        )}
        {collapsed && <span style={{ color: '#666' }}>{closeBracket}</span>}
        {!collapsed && (
          <span style={{ color: '#888', fontSize: '11px', marginLeft: '6px' }}>
            ({countLabel})
          </span>
        )}
        <button
          onClick={handleCopy}
          title="Copy node to clipboard"
          style={{
            marginLeft: '8px',
            background: 'transparent',
            border: 'none',
            color: copied ? '#4caf50' : '#666',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '0 4px',
          }}
        >
          {copied ? '✓ copied' : '📋'}
        </button>
      </div>

      {!collapsed && (
        <div>
          {entries.map(([k, val], index) => (
            <JsonTreeNode
              key={k}
              keyName={isArray ? undefined : k}
              value={val}
              depth={depth + 1}
              isLast={index === entries.length - 1}
            />
          ))}
          <div style={{ color: '#666' }}>
            {closeBracket}
            {!isLast && ','}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main JsonParser React component in JSX.
 */
export function JsonParser({
  initialValue = SAMPLE_JSON,
  onParse,
  onError,
  options = {},
  theme = 'dark',
  height = '540px',
  showToolbar = true,
}) {
  const [input, setInput] = useState(initialValue);
  const [activeTab, setActiveTab] = useState('tree'); // 'tree' | 'formatted' | 'ast'
  const [error, setError] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [astData, setAstData] = useState(null);
  const [parseTimeMs, setParseTimeMs] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [relaxedMode, setRelaxedMode] = useState(false);

  // Parse logic with performance timing
  useEffect(() => {
    const parseOpts = {
      ...options,
      allowComments: relaxedMode || options.allowComments,
      allowTrailingCommas: relaxedMode || options.allowTrailingCommas,
      allowSingleQuotes: relaxedMode || options.allowSingleQuotes,
      allowUnquotedKeys: relaxedMode || options.allowUnquotedKeys,
      allowNumericExtensions: relaxedMode || options.allowNumericExtensions,
    };

    const startTime = performance.now();
    try {
      const result = parse(input, parseOpts);
      const ast = parseToAST(input, parseOpts);
      const elapsed = performance.now() - startTime;

      setParsedData(result);
      setAstData(ast);
      setError(null);
      setParseTimeMs(Math.round(elapsed * 100) / 100);

      if (onParse) onParse(result, ast);
    } catch (err) {
      if (err instanceof JSONSyntaxError) {
        setError(err);
      } else {
        setError({
          name: 'Error',
          formattedMessage: err.message || String(err),
          line: 1,
          column: 1,
        });
      }
      setParsedData(null);
      setAstData(null);
      if (onError) onError(err);
    }
  }, [input, relaxedMode, options, onParse, onError]);

  // Toolbar handlers
  const handleFormat = (spaces = 2) => {
    if (parsedData !== null) {
      const formatted = stringify(parsedData, null, spaces);
      if (formatted !== undefined) setInput(formatted);
    }
  };

  const handleMinify = () => {
    if (parsedData !== null) {
      const minified = stringify(parsedData);
      if (minified !== undefined) setInput(minified);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(input);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 1500);
  };

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1e1e1e' : '#f9f9f9';
  const cardBg = isDark ? '#252526' : '#ffffff';
  const textColor = isDark ? '#d4d4d4' : '#222222';
  const borderColor = isDark ? '#3c3c3c' : '#e0e0e0';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: bgColor,
        color: textColor,
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        height,
        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header & Toolbar */}
      {showToolbar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            background: cardBg,
            borderBottom: `1px solid ${borderColor}`,
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#00bcd4' }}>
              ✦ JSON Parser
            </span>
            {error ? (
              <span
                style={{
                  background: '#ffebee',
                  color: '#c62828',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              >
                ✕ Syntax Error (Line {error.line}:{error.column})
              </span>
            ) : (
              <span
                style={{
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              >
                ✓ Valid JSON ({parseTimeMs}ms)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => handleFormat(2)}
              disabled={!!error}
              style={{
                background: isDark ? '#333' : '#f0f0f0',
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: error ? 'not-allowed' : 'pointer',
                opacity: error ? 0.5 : 1,
              }}
            >
              Format (2 spaces)
            </button>
            <button
              onClick={handleMinify}
              disabled={!!error}
              style={{
                background: isDark ? '#333' : '#f0f0f0',
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: error ? 'not-allowed' : 'pointer',
                opacity: error ? 0.5 : 1,
              }}
            >
              Minify
            </button>
            <button
              onClick={handleCopy}
              style={{
                background: isDark ? '#333' : '#f0f0f0',
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {copySuccess ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setInput(SAMPLE_JSON)}
              style={{
                background: isDark ? '#333' : '#f0f0f0',
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Sample
            </button>
            <button
              onClick={() => setInput('')}
              style={{
                background: isDark ? '#333' : '#f0f0f0',
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                marginLeft: '6px',
              }}
            >
              <input
                type="checkbox"
                checked={relaxedMode}
                onChange={(e) => setRelaxedMode(e.target.checked)}
              />
              Relaxed Mode
            </label>
          </div>
        </div>
      )}

      {/* Main Panes Container */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: Input Textarea */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${borderColor}`,
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              color: '#888',
              background: cardBg,
              borderBottom: `1px solid ${borderColor}`,
            }}
          >
            Raw JSON Input
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck="false"
            placeholder="Paste or type JSON here..."
            style={{
              flex: 1,
              width: '100%',
              background: 'transparent',
              color: textColor,
              border: 'none',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Right: Output / Inspector */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              background: cardBg,
              borderBottom: `1px solid ${borderColor}`,
              padding: '0 8px',
            }}
          >
            {['tree', 'formatted', 'ast'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'transparent',
                  color: activeTab === tab ? '#00bcd4' : '#888',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #00bcd4' : '2px solid transparent',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {tab === 'tree' ? 'Tree View' : tab === 'formatted' ? 'Formatted' : 'AST'}
              </button>
            ))}
          </div>

          {/* Tab Content / Error View */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {error ? (
              <div
                style={{
                  background: isDark ? '#2b1b1f' : '#fff0f2',
                  border: '1px solid #e57373',
                  borderRadius: '6px',
                  padding: '12px',
                  color: isDark ? '#ff8a80' : '#b71c1c',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
                  ⚠️ {error.rawMessage || 'JSON Syntax Error'} (Line {error.line}, Column {error.column})
                </div>
                {error.snippet && (
                  <pre
                    style={{
                      margin: 0,
                      padding: '8px',
                      background: isDark ? '#1a1113' : '#fbe9e7',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      overflowX: 'auto',
                      lineHeight: '1.5',
                      color: isDark ? '#ffcdd2' : '#c62828',
                    }}
                  >
                    {error.snippet}
                  </pre>
                )}
              </div>
            ) : activeTab === 'tree' ? (
              <div style={{ padding: '4px 0' }}>
                {parsedData !== null ? (
                  <JsonTreeNode value={parsedData} depth={0} />
                ) : (
                  <span style={{ color: '#888', fontStyle: 'italic' }}>Empty JSON</span>
                )}
              </div>
            ) : activeTab === 'formatted' ? (
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: textColor,
                }}
              >
                {stringify(parsedData, null, 2)}
              </pre>
            ) : (
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: '#90caf9',
                }}
              >
                {JSON.stringify(astData, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default JsonParser;
