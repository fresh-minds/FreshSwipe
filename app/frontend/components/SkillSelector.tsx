'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './SkillSelector.module.css';

interface Skill {
    id: string;
    name: string;
    category: string;
}

interface SkillSelectorProps {
    title: string;
    description: string;
    selectedSkillIds: string[];
    onChange: (ids: string[]) => void;
    availableSkills: Skill[];
}

export default function SkillSelector({
    title,
    description,
    selectedSkillIds,
    onChange,
    availableSkills
}: SkillSelectorProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Group skills by category
    const groupedSkills = availableSkills.reduce((acc, skill) => {
        if (!acc[skill.category]) {
            acc[skill.category] = [];
        }
        acc[skill.category].push(skill);
        return acc;
    }, {} as Record<string, Skill[]>);

    const toggleSkill = (skillId: string) => {
        if (selectedSkillIds.includes(skillId)) {
            onChange(selectedSkillIds.filter(id => id !== skillId));
        } else {
            onChange([...selectedSkillIds, skillId]);
        }
    };

    const filteredSkills = availableSkills.filter(skill =>
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={styles.container} ref={containerRef}>
            <div className={styles.header}>
                <span className={styles.titleLabel}>{title}</span>
                <span className={styles.description}>{description}</span>
            </div>

            {/* Selected Skills Chips */}
            <div className={styles.chipsContainer}>
                {selectedSkillIds.map(id => {
                    const skill = availableSkills.find(s => s.id === id);
                    if (!skill) return null;
                    return (
                        <div key={id} className={styles.chip}>
                            <span>{skill.name}</span>
                            <button
                                type="button"
                                onClick={() => toggleSkill(id)}
                                className={styles.removeBtn}
                                aria-label={`Remove ${skill.name}`}
                            >
                                ×
                            </button>
                        </div>
                    );
                })}
                <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                >
                    + Add Skill
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className={styles.dropdown} role="listbox" aria-label={title} aria-multiselectable="true">
                    <input
                        type="text"
                        placeholder="Search skills or categories..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                        autoFocus
                        aria-label={`Search ${title}`}
                    />
                    <div className={styles.list}>
                        {searchTerm ? (
                            filteredSkills.length > 0 ? (
                                filteredSkills.map(skill => {
                                    const selected = selectedSkillIds.includes(skill.id);
                                    return (
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={selected}
                                            key={skill.id}
                                            className={`${styles.listItem} ${selected ? styles.selected : ''}`}
                                            onClick={() => toggleSkill(skill.id)}
                                        >
                                            <span>{skill.name}</span>
                                            <span className={styles.category}>{skill.category}</span>
                                        </button>
                                    );
                                })
                            ) : (
                                <p className={styles.emptySearch}>No matching skills found.</p>
                            )
                        ) : (
                            Object.entries(groupedSkills).map(([category, skills]) => (
                                <div key={category} className={styles.categoryGroup}>
                                    <h4>{category}</h4>
                                    {skills.map(skill => {
                                        const selected = selectedSkillIds.includes(skill.id);
                                        return (
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={selected}
                                                key={skill.id}
                                                className={`${styles.listItem} ${selected ? styles.selected : ''}`}
                                                onClick={() => toggleSkill(skill.id)}
                                            >
                                                <span>{skill.name}</span>
                                                {selected && <span aria-hidden="true">✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                    <button type="button" className={styles.closeBtn} onClick={() => setIsOpen(false)}>Done</button>
                </div>
            )}
        </div>
    );
}
