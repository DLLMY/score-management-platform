import React from 'react';
import { Sparkles, Brain, Send, RefreshCw, Check, Edit2 } from 'lucide-react';
import { PermissionButton } from '../../components';
import type { NLPDeps } from './types';

export function ParseTab({ deps }: { deps: NLPDeps }): React.ReactElement {
  const {
    inputText,
    setInputText,
    parseText,
    isParsing,
    parseResult,
    selectedRuleId,
    setSelectedRuleId,
    executeScoring,
    applySuggestionAsRule,
    suggestedRules,
    setManualCorrection,
    setShowCorrectionModal,
    showCorrectionList,
    setShowCorrectionList,
    setCorrectionsPage,
    fetchCorrections,
  } = deps;

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-xl shadow-sm p-6'>
        <h2 className='text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2'>
          <Sparkles className='w-5 h-5 text-blue-500' />
          自然语言输入
        </h2>
        <div className='flex gap-3'>
          <input
            type='text'
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && parseText()}
            placeholder='输入自然语言文本，如：张三上课睡觉扣分、李四上课积极回答问题'
            className='flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
          />
          <PermissionButton
            permission='score.entry'
            onClick={parseText}
            disabled={isParsing}
            className='px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2'
          >
            {isParsing ? (
              <RefreshCw className='w-5 h-5 animate-spin' />
            ) : (
              <Send className='w-5 h-5' />
            )}
            解析
          </PermissionButton>
        </div>
      </div>

      {parseResult && (
        <div className='bg-white rounded-xl shadow-sm p-6'>
          <h2 className='text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2'>
            <Brain className='w-5 h-5 text-purple-500' />
            解析结果
          </h2>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
            <div className='p-4 bg-gray-50 rounded-lg'>
              <p className='text-sm text-gray-500 mb-1'>提取姓名</p>
              <p className='text-lg font-semibold text-gray-800'>
                {parseResult.extracted_name || '未识别'}
              </p>
            </div>
            <div className='p-4 bg-gray-50 rounded-lg'>
              <p className='text-sm text-gray-500 mb-1'>行为描述</p>
              <p className='text-lg font-semibold text-gray-800'>{parseResult.behavior}</p>
            </div>
            <div className='p-4 bg-gray-50 rounded-lg'>
              <p className='text-sm text-gray-500 mb-1'>评分意图</p>
              <p
                className={`text-lg font-semibold ${
                  parseResult.intent === 'add'
                    ? 'text-green-600'
                    : parseResult.intent === 'deduct'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {parseResult.intent === 'add'
                  ? '加分'
                  : parseResult.intent === 'deduct'
                    ? '扣分'
                    : '未知'}
              </p>
            </div>
            <div className='p-4 bg-gray-50 rounded-lg'>
              <p className='text-sm text-gray-500 mb-1'>置信度</p>
              <p className='text-lg font-semibold text-blue-600'>
                {parseResult.confidence * 100}%
              </p>
            </div>
          </div>

          {parseResult.matched_rules.length > 0 && (
            <div className='mb-6'>
              <h3 className='text-sm font-medium text-gray-600 mb-3'>
                匹配规则{' '}
                {parseResult.matched_rules.length > 1 && (
                  <span className='text-xs text-gray-400'>(请选择一条)</span>
                )}
              </h3>
              <div className='space-y-3'>
                {parseResult.matched_rules.map((rule, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedRuleId(rule.rule_id || index)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      rule.rule_id === selectedRuleId ||
                      (selectedRuleId === null && index === 0)
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                        : rule.score_type === 'add'
                          ? 'border-green-200 bg-green-50 hover:border-green-300'
                          : 'border-red-200 bg-red-50 hover:border-red-300'
                    }`}
                  >
                    <div className='flex items-center gap-3'>
                      <input
                        type='radio'
                        name='selectedRule'
                        checked={
                          rule.rule_id === selectedRuleId ||
                          (selectedRuleId === null && index === 0)
                        }
                        onChange={() => setSelectedRuleId(rule.rule_id || index)}
                        className='w-4 h-4 text-blue-600'
                      />
                      <div className='flex-1'>
                        <p className='font-medium text-gray-800'>{rule.behavior_description}</p>
                        <p className='text-sm text-gray-500'>关键词: {rule.behavior_keyword}</p>
                      </div>
                      <span
                        className={`text-xl font-bold ${
                          rule.score_type === 'add' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {rule.score_type === 'add' ? '+' : ''}
                        {rule.score_value}
                      </span>
                    </div>
                    <div className='flex items-center gap-4 mt-2 text-sm text-gray-500 ml-7'>
                      <span>使用次数: {rule.usage_count}</span>
                      <span>
                        准确率:{' '}
                        {rule.accuracy_rate != null
                          ? `${(rule.accuracy_rate * 100).toFixed(1)}%`
                          : '--'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const genericSuggestions = (parseResult.suggestions || []).filter(
              (s) => typeof s?.rule_id !== 'number'
            );
            const similarSuggestions = (parseResult.suggestions || []).filter(
              (s): s is NonNullable<typeof s> & { rule_id: number } =>
                typeof s?.rule_id === 'number'
            );
            const hasAny = genericSuggestions.length > 0 || similarSuggestions.length > 0;
            if (!hasAny) return null;
            return (
              <div className='mb-6'>
                {genericSuggestions.length > 0 && (
                  <div className='mb-4'>
                    <h3 className='text-sm font-medium text-gray-600 mb-3'>建议</h3>
                    <div className='space-y-2'>
                      {genericSuggestions.map((suggestion, index) => (
                        <div
                          key={`g-${index}`}
                          className='p-3 bg-yellow-50 rounded-lg border border-yellow-200'
                        >
                          <p className='text-gray-700'>{suggestion.description}</p>
                          <p className='text-sm text-yellow-700'>
                            建议{suggestion.intent === 'add' ? '加' : '扣'}分:{' '}
                            {suggestion.score_value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {similarSuggestions.length > 0 && (
                  <div>
                    <h3 className='text-sm font-medium text-gray-600 mb-3'>
                      相似规则推荐
                      <span className='ml-2 text-xs text-gray-400'>
                        （点击「一键应用」可直接套用扣分）
                      </span>
                    </h3>
                    <div className='space-y-2'>
                      {similarSuggestions.map((suggestion, index) => (
                        <div
                          key={`s-${index}`}
                          className='p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between gap-3'
                        >
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-2 mb-1'>
                              <span className='font-medium text-gray-800 truncate'>
                                {suggestion.description}
                              </span>
                              {typeof suggestion.similarity === 'number' && (
                                <span className='text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700'>
                                  相似度 {(suggestion.similarity * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <p className='text-sm text-gray-500'>
                              规则 #{suggestion.rule_id} · 建议
                              {suggestion.intent === 'add' ? '加' : '扣'}分{' '}
                              {suggestion.score_value}
                            </p>
                          </div>
                          <PermissionButton
                            permission='score.entry'
                            size='sm'
                            type='primary'
                            onClick={() => applySuggestionAsRule(suggestion)}
                            className='!px-3 !py-1 shrink-0'
                          >
                            一键应用
                          </PermissionButton>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {suggestedRules.length > 0 && !parseResult.matched_rules.length && (
            <div className='mb-6'>
              <h3 className='text-sm font-medium text-gray-600 mb-3'>
                相似规则推荐（库内匹配）
              </h3>
              <div className='space-y-2'>
                {suggestedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className='p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-300'
                    onClick={() => {
                      setManualCorrection({
                        intent: rule.score_type,
                        score_value: rule.score_value,
                        behavior_tags: rule.behavior_tags,
                        behavior_description: rule.behavior_description,
                        feedback_note: '',
                      });
                      setShowCorrectionModal(true);
                    }}
                  >
                    <p className='font-medium text-gray-800'>{rule.behavior_description}</p>
                    <p className='text-sm text-gray-500'>
                      关键词: {rule.behavior_keyword} | 分数:{' '}
                      {rule.score_type === 'add' ? '+' : ''}
                      {rule.score_value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className='flex gap-3'>
            {parseResult.success && parseResult.matched_rules.length > 0 && (
              <PermissionButton
                permission='score.entry'
                onClick={executeScoring}
                className='px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2'
              >
                <Check className='w-5 h-5' />
                确认评分
              </PermissionButton>
            )}
            <PermissionButton
              permission='score.entry'
              onClick={() => {
                setManualCorrection({
                  intent: parseResult.intent === 'unknown' ? 'add' : parseResult.intent,
                  score_value: parseResult.matched_rules[0]?.score_value || 5,
                  behavior_tags: [],
                  behavior_description: parseResult.behavior,
                  feedback_note: '',
                });
                setShowCorrectionModal(true);
              }}
              className='px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2'
            >
              <Edit2 className='w-5 h-5' />
              手动修正
            </PermissionButton>
            <button
              onClick={() => {
                setShowCorrectionList(!showCorrectionList);
                if (!showCorrectionList) {
                  setCorrectionsPage(1);
                  fetchCorrections();
                }
              }}
              className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                showCorrectionList
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
            >
              <Brain className='w-5 h-5' />
              纠正记录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
